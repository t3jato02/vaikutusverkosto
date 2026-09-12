import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType } from "@prisma/client";
import { publishRoleAssignment, publishInstitutionalCategory } from "@/lib/agents/publish";
import type { RunContext, RoleAssignmentFact, InstitutionalCategoryFact } from "@/lib/agents/types";
import {
  organizationsByCategory,
  personsByInstitutionalRole,
  organizationLeadership,
  institutionalProfile,
  revolvingDoorTransitions,
} from "@/lib/institutionalPower/institutionQueries";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

function makeCtx(agentId = "pubinst-query-test"): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: `${agentId}-${Date.now()}`, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
}

const OFFICIAL = {
  sourceType: "OFFICIAL_REGISTER" as const,
  sourceName: "Testi virallinen lähde",
  publisher: "Testi",
  confidence: "HIGH" as const,
};

describe.skipIf(!db)("public-institutions query layer (stream C)", () => {
  const createdEntities: string[] = [];
  const createdPositions: string[] = [];
  const createdCategories: string[] = [];
  const ORG = { type: EntityType.GOVERNMENT_BODY, name: "Pubinst Testikaupunki", jurisdiction: "FI" };
  const ORG2 = { type: EntityType.PUBLIC_AUTHORITY, name: "Pubinst Testivirasto", jurisdiction: "FI" };

  async function trackEntityId(ref: { type: EntityType; name: string }): Promise<string | null> {
    const e = await db!.entity.findFirst({ where: { type: ref.type, canonicalName: ref.name } });
    if (e) createdEntities.push(e.id);
    return e?.id ?? null;
  }

  afterAll(async () => {
    if (!db) return;
    await db!.position.deleteMany({ where: { id: { in: createdPositions } } });
    await db!.organizationInstitutionalCategory.deleteMany({ where: { id: { in: createdCategories } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  it("organizationsByCategory returns organisations of a documented category", async () => {
    const ctx = makeCtx();
    const cat: InstitutionalCategoryFact = {
      kind: "institutional-category",
      organization: ORG,
      category: "MUNICIPALITY",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/q-category",
    };
    await publishInstitutionalCategory(ctx, cat);
    const orgId = await trackEntityId(ORG);
    const row = await db!.organizationInstitutionalCategory.findFirst({ where: { entityId: orgId! } });
    createdCategories.push(row!.id);

    const results = await organizationsByCategory({ category: "MUNICIPALITY" });
    const hit = results.find((r) => r.entity.id === orgId);
    expect(hit).toBeTruthy();
    expect(hit!.categoryLabel).toBe("Kunta");
    expect(hit!.sourceUrl).toBe("https://example.fi/q-category");
  });

  it("organizationLeadership returns current-then-historical roles for an organisation", async () => {
    const ctx = makeCtx();
    const orgId = await trackEntityId(ORG);
    const current = await publishRoleAssignment(ctx, roleFact("Pubinst Nykyinen Pormestari", "Pubinst Testikaupunki", { role: "Pormestari", roleType: "MUNICIPAL_POLITICIAN", startDate: new Date("2021-08-01"), assertedCurrent: true }));
    expect(current.action).toBe("created");
    const historical = await publishRoleAssignment(ctx, roleFact("Pubinst Entinen Pormestari", "Pubinst Testikaupunki", { role: "Pormestari", roleType: "MUNICIPAL_POLITICIAN", startDate: new Date("2017-01-01"), endDate: new Date("2021-07-31") }));
    expect(historical.action).toBe("created");

    const leadership = await organizationLeadership(orgId!);
    const pos = await db!.position.findMany({ where: { organizationEntityId: orgId! } });
    createdPositions.push(...pos.map((p) => p.id));

    const currentRoles = leadership.filter((l) => l.isCurrent);
    const historicalRoles = leadership.filter((l) => !l.isCurrent);
    expect(currentRoles.length).toBe(1);
    expect(historicalRoles.length).toBe(1);
    expect(currentRoles[0].personEntity.canonicalName).toBe("Pubinst Nykyinen Pormestari");
  });

  it("personsByInstitutionalRole filters by current vs historical role", async () => {
    const ctx = makeCtx();
    await publishRoleAssignment(ctx, roleFact("Pubinst Entinen Virkamies", "Pubinst Testivirasto", { role: "Pääjohtaja", roleType: "DIRECTOR_GENERAL", startDate: new Date("2015-01-01"), endDate: new Date("2020-12-31") }));
    await publishRoleAssignment(ctx, roleFact("Pubinst Nykyinen Virkamies", "Pubinst Testivirasto", { role: "Pääjohtaja", roleType: "DIRECTOR_GENERAL", startDate: new Date("2021-01-01"), assertedCurrent: true }));
    const org2Id = await trackEntityId(ORG2);
    const pos = await db!.position.findMany({ where: { organizationEntityId: org2Id! } });
    createdPositions.push(...pos.map((p) => p.id));

    const current = await personsByInstitutionalRole({ roleType: "DIRECTOR_GENERAL", current: true });
    const historical = await personsByInstitutionalRole({ roleType: "DIRECTOR_GENERAL", current: false });
    expect(current.some((r) => r.personEntity.canonicalName === "Pubinst Nykyinen Virkamies")).toBe(true);
    expect(historical.some((r) => r.personEntity.canonicalName === "Pubinst Entinen Virkamies")).toBe(true);
    expect(historical.some((r) => r.personEntity.canonicalName === "Pubinst Nykyinen Virkamies")).toBe(false);
  });

  it("institutionalProfile batches the institution-person graph for a person", async () => {
    const ctx = makeCtx();
    const person = "Pubinst Profiilihenkilö";
    await publishRoleAssignment(ctx, roleFact(person, "Pubinst Testivirasto", { role: "Johtaja", roleType: "CIVIL_SERVANT", startDate: new Date("2015-01-01"), endDate: new Date("2021-12-31") }));
    // Cross-sphere second role: civil servant → company board member.
    await publishRoleAssignment(ctx, {
      ...roleFact(person, "Pubinst Testiyhtiö Oy", { role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", startDate: new Date("2022-01-01"), assertedCurrent: true }),
      organization: { type: EntityType.COMPANY, name: "Pubinst Testiyhtiö Oy", jurisdiction: "FI" },
    });
    const personId = await trackEntityId({ type: EntityType.PERSON, name: person });
    const companyId = await trackEntityId({ type: EntityType.COMPANY, name: "Pubinst Testiyhtiö Oy" });
    const pos = await db!.position.findMany({ where: { OR: [{ personEntityId: personId! }, { organizationEntityId: companyId! }] } });
    createdPositions.push(...pos.map((p) => p.id));

    const profile = await institutionalProfile(personId!);
    expect(profile).not.toBeNull();
    expect(profile!.positions.length).toBe(2);
    expect(profile!.relationships).toBeInstanceOf(Array);
    // A documented sequential transition (civil servant → company board) must
    // be surfaced by the revolving-door view.
    const transitions = await revolvingDoorTransitions(personId!);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
  });
});

function roleFact(person: string, org: string, extra: Partial<RoleAssignmentFact> = {}): RoleAssignmentFact {
  return {
    kind: "role",
    person: { type: EntityType.PERSON, name: person, jurisdiction: "FI" },
    organization: { type: EntityType.GOVERNMENT_BODY, name: org, jurisdiction: "FI" },
    role: "Testitehtävä",
    ...OFFICIAL,
    evidenceUrl: "https://example.fi/pub-inst-query",
    ...extra,
  };
}