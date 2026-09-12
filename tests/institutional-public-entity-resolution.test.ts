import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType } from "@prisma/client";
import { publishRoleAssignment, publishInstitutionalCategory } from "@/lib/agents/publish";
import type { RunContext, RoleAssignmentFact, InstitutionalCategoryFact } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

function makeCtx(agentId = "pubinst-test-agent"): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: `${agentId}-${Date.now()}`, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
}

const OFFICIAL = {
  sourceType: "OFFICIAL_REGISTER" as const,
  sourceName: "Testi virallinen lähde",
  publisher: "Testi julkaisija",
  confidence: "HIGH" as const,
};

function roleFact(person: string, org: string, extra: Partial<RoleAssignmentFact> = {}): RoleAssignmentFact {
  return {
    kind: "role",
    person: { type: EntityType.PERSON, name: person, jurisdiction: "FI" },
    organization: { type: EntityType.ORGANIZATION, name: org, jurisdiction: "FI" },
    role: "Testitehtävä",
    ...OFFICIAL,
    evidenceUrl: "https://example.fi/pub-inst-role",
    ...extra,
  };
}

describe.skipIf(!db)("public-institutions entity resolution (stream C)", () => {
  const createdEntities: string[] = [];
  const createdPositions: string[] = [];
  const createdCategories: string[] = [];
  const provider = `pubinst-test-${Date.now()}`;

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
    await db!.entityResolutionCandidate.deleteMany({ where: { refExternalProvider: provider } });
    await db!.externalIdentifier.deleteMany({ where: { provider } });
  });

  it("reuses an existing canonical person instead of creating a duplicate", async () => {
    const ctx = makeCtx();
    const existing = await db!.entity.create({
      data: {
        type: EntityType.PERSON,
        canonicalName: "Pubinst Testipoliitikko",
        jurisdiction: "FI",
        externalIds: { create: { provider, identifier: "mp-1" } },
      },
    });
    createdEntities.push(existing.id);
    const res = await publishRoleAssignment(ctx, roleFact("Pubinst Testipoliitikko", "Pubinst Testivirasto", { roleType: "CIVIL_SERVANT" }));
    expect(res.action).toBe("created");
    const persons = await db!.entity.findMany({ where: { canonicalName: "Pubinst Testipoliitikko", type: EntityType.PERSON } });
    expect(persons.length).toBe(1);
    expect(persons[0].id).toBe(existing.id);
    const pos = await db!.position.findFirst({ where: { personEntityId: existing.id } });
    createdPositions.push(pos!.id);
  });

  it("never merges two same-name people on name alone — parks an entity resolution candidate", async () => {
    const ctx = makeCtx();
    const name = "Pubinst Kaksoisolento";
    await db!.entityResolutionCandidate.deleteMany({ where: { refName: name } });
    const a = await db!.entity.create({
      data: { type: EntityType.PERSON, canonicalName: name, jurisdiction: "FI", externalIds: { create: { provider, identifier: "dup-a" } } },
    });
    const b = await db!.entity.create({
      data: { type: EntityType.PERSON, canonicalName: name, jurisdiction: "FI", externalIds: { create: { provider, identifier: "dup-b" } } },
    });
    createdEntities.push(a.id, b.id);
    const res = await publishRoleAssignment(ctx, roleFact(name, "Pubinst Testiorganisaatio"));
    // A name-only ref with two matches is UNRESOLVED → the role is rejected and
    // parked for human review, never auto-assigned.
    expect(res.action).toBe("rejected");
    const cand = await db!.entityResolutionCandidate.findFirst({ where: { refName: name, status: "PENDING" } });
    expect(cand).not.toBeNull();
    await db!.entityResolutionCandidate.deleteMany({ where: { refName: name } });
  });

  it("prevents duplicate organisations and deduplicates institutional categories", async () => {
    const ctx = makeCtx();
    const fact = roleFact("Pubinst Johtaja", "Pubinst Energiayhtiö Oy", { roleType: "CEO" });
    await publishRoleAssignment(ctx, fact);
    await publishRoleAssignment(ctx, { ...fact });
    const orgs = await db!.entity.findMany({ where: { canonicalName: "Pubinst Energiayhtiö Oy" } });
    expect(orgs.length).toBe(1);
    const orgId = await trackEntityId({ type: EntityType.ORGANIZATION, name: "Pubinst Energiayhtiö Oy" });

    const cat: InstitutionalCategoryFact = {
      kind: "institutional-category",
      organization: { type: EntityType.ORGANIZATION, name: "Pubinst Energiayhtiö Oy", jurisdiction: "FI" },
      category: "STATE_OWNED_COMPANY",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/pub-inst-category",
    };
    const first = await publishInstitutionalCategory(ctx, cat);
    expect(first.action).toBe("created");
    const second = await publishInstitutionalCategory(ctx, cat);
    expect(second.action).toBe("unchanged");
    const rows = await db!.organizationInstitutionalCategory.findMany({ where: { entityId: orgId!, category: "STATE_OWNED_COMPANY" } });
    expect(rows.length).toBe(1);
    createdCategories.push(...rows.map((r) => r.id));

    const positions = await db!.position.findMany({ where: { organizationEntityId: orgId!, role: "Testitehtävä" } });
    expect(positions.length).toBe(1);
    createdPositions.push(...positions.map((p) => p.id));
  });
});

describe.skipIf(!db)("public-institutions temporal semantics (stream C)", () => {
  const createdEntities: string[] = [];
  const createdPositions: string[] = [];

  async function trackEntityId(ref: { type: EntityType; name: string }): Promise<string | null> {
    const e = await db!.entity.findFirst({ where: { type: ref.type, canonicalName: ref.name } });
    if (e) createdEntities.push(e.id);
    return e?.id ?? null;
  }

  afterAll(async () => {
    if (!db) return;
    await db!.position.deleteMany({ where: { id: { in: createdPositions } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  it("keeps a role with a past end date HISTORICAL (never presented as current)", async () => {
    const ctx = makeCtx();
    const res = await publishRoleAssignment(
      ctx,
      roleFact("Pubinst Entinen Ministeri", "Pubinst Ministeriö", {
        role: "Ministeri",
        roleType: "MINISTER",
        startDate: new Date("2019-06-06"),
        endDate: new Date("2023-06-20"),
      }),
    );
    expect(res.action).toBe("created");
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Pubinst Entinen Ministeri" });
    const pos = await db!.position.findFirst({ where: { personEntityId: personId!, role: "Ministeri" } });
    expect(pos!.isCurrent).toBe(false);
    createdPositions.push(pos!.id);
  });

  it("keeps an open-ended role asserted current as CURRENT", async () => {
    const ctx = makeCtx();
    const res = await publishRoleAssignment(
      ctx,
      roleFact("Pubinst Nykyinen Johtaja", "Pubinst Virasto", {
        role: "Pääjohtaja",
        roleType: "DIRECTOR_GENERAL",
        startDate: new Date("2020-01-01"),
        assertedCurrent: true,
      }),
    );
    expect(res.action).toBe("created");
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Pubinst Nykyinen Johtaja" });
    const pos = await db!.position.findFirst({ where: { personEntityId: personId! } });
    expect(pos!.isCurrent).toBe(true);
    createdPositions.push(pos!.id);
  });

  it("preserves role chronology across transitions (former ministry role then current agency role)", async () => {
    const ctx = makeCtx();
    const person = "Pubinst Siirtyjä";
    await publishRoleAssignment(
      ctx,
      roleFact(person, "Pubinst Ministeriö", { role: "Osastopäällikkö", roleType: "CIVIL_SERVANT", startDate: new Date("2015-01-01"), endDate: new Date("2021-12-31") }),
    );
    await publishRoleAssignment(
      ctx,
      roleFact(person, "Pubinst Virasto", { role: "Pääjohtaja", roleType: "DIRECTOR_GENERAL", startDate: new Date("2022-01-01"), assertedCurrent: true }),
    );
    const personId = await trackEntityId({ type: EntityType.PERSON, name: person });
    const rows = await db!.position.findMany({
      where: { personEntityId: personId! },
      orderBy: { startDate: "asc" },
    });
    createdPositions.push(...rows.map((r) => r.id));
    expect(rows.length).toBe(2);
    expect(rows[0].isCurrent).toBe(false);
    expect(rows[1].isCurrent).toBe(true);
    // Chronology: the earlier role must not have an end date after the later
    // role's start (a valid sequential transition).
    expect(rows[1].startDate!.getTime()).toBeGreaterThanOrEqual(rows[0].endDate!.getTime());
  });
});