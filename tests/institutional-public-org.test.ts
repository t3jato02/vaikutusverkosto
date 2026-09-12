import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType, RelationshipType } from "@prisma/client";
import { publicInstitutionSections } from "@/lib/agents/data/institutions";
import { publishInstitutionalCategory, publishVerifiedFact, publishRoleAssignment } from "@/lib/agents/publish";
import type { RunContext, RoleAssignmentFact, InstitutionalCategoryFact, NormalizedFact } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

describe("public-institutions manifest integrity (stream C)", () => {
  it("every organisation has a stable id, category, evidence URL and unique identity", () => {
    const ids = new Set<string>();
    for (const s of publicInstitutionSections) {
      for (const org of s.orgs) {
        expect(org.id).toBeTruthy();
        expect(ids.has(org.id)).toBe(false);
        ids.add(org.id);
        expect(org.category).toBeTruthy();
        expect(org.evidenceUrl).toMatch(/^https?:\/\//);
        expect(org.sourceName).toBeTruthy();
        expect(org.type).toBeTruthy();
      }
    }
    expect(ids.size).toBeGreaterThan(75);
  });

  it("every role references an existing organisation and carries evidence + a role type", () => {
    for (const s of publicInstitutionSections) {
      const ids = new Set(s.orgs.map((o) => o.id));
      for (const r of s.roles) {
        expect(ids.has(r.org)).toBe(true);
        expect(r.person).toBeTruthy();
        expect(r.role).toBeTruthy();
        expect(r.roleType).toBeTruthy();
        expect(r.evidenceUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("every supervision reference points at a ministry in the same manifest", () => {
    for (const s of publicInstitutionSections) {
      const ids = new Set(s.orgs.map((o) => o.id));
      for (const org of s.orgs) {
        if (org.supervisedBy) expect(ids.has(org.supervisedBy)).toBe(true);
      }
    }
  });

  it("roles with an end date are marked historical; open-ended roles carry a current flag", () => {
    for (const s of publicInstitutionSections) {
      for (const r of s.roles) {
        expect(r.current).toBeTypeOf("boolean");
        if (r.endDate) expect(r.current).toBe(false);
      }
    }
  });
});

describe.skipIf(!db)("public-institutions organisation publication (stream C)", () => {
  const createdEntities: string[] = [];
  const createdCategories: string[] = [];
  const createdRels: string[] = [];

  async function trackEntityId(ref: { type: EntityType; name: string }): Promise<string | null> {
    const e = await db!.entity.findFirst({ where: { type: ref.type, canonicalName: ref.name } });
    if (e) createdEntities.push(e.id);
    return e?.id ?? null;
  }

  afterAll(async () => {
    if (!db) return;
    await db!.relationship.deleteMany({ where: { id: { in: createdRels } } });
    await db!.organizationInstitutionalCategory.deleteMany({ where: { id: { in: createdCategories } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  function makeCtx(agentId = "pubinst-org-test"): RunContext {
    const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
    return { runId: `${agentId}-${Date.now()}`, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
  }

  it("publishes the correct institutional category for an organisation", async () => {
    const ctx = makeCtx();
    const fact: InstitutionalCategoryFact = {
      kind: "institutional-category",
      organization: { type: EntityType.GOVERNMENT_BODY, name: "Pubinst Testikunta", jurisdiction: "FI" },
      category: "MUNICIPALITY",
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Testi lähde",
      publisher: "Testi",
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/org-category",
    };
    const res = await publishInstitutionalCategory(ctx, fact);
    expect(res.action).toBe("created");
    const orgId = await trackEntityId({ type: EntityType.GOVERNMENT_BODY, name: "Pubinst Testikunta" });
    const row = await db!.organizationInstitutionalCategory.findFirst({ where: { entityId: orgId! } });
    expect(row!.category).toBe("MUNICIPALITY");
    createdCategories.push(row!.id);
  });

  it("publishes a ministry SUPERVISES agency relationship through the verified lane", async () => {
    const ctx = makeCtx();
    const fact: NormalizedFact = {
      kind: "relationship",
      source: { type: EntityType.GOVERNMENT_BODY, name: "Pubinst Testiministeriö", jurisdiction: "FI" },
      target: { type: EntityType.PUBLIC_AUTHORITY, name: "Pubinst Testivirasto", jurisdiction: "FI" },
      relationshipType: RelationshipType.SUPERVISES,
      role: "Hallinnonalan ohjaus",
      assertedCurrent: true,
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/supervision",
      extractionMethod: "deterministic-parser",
    };
    const result = await publishVerifiedFact(ctx, {
      kind: "relationship",
      source: fact.source,
      target: fact.target,
      relationshipType: fact.relationshipType,
      role: fact.role,
      assertedCurrent: true,
      confidence: fact.confidence,
      evidenceUrl: fact.evidenceUrl,
      extractionMethod: "deterministic-parser",
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Testi lähde",
      publisher: "Testi",
    });
    expect(result.action).toBe("created");
    const ministryId = await trackEntityId({ type: EntityType.GOVERNMENT_BODY, name: "Pubinst Testiministeriö" });
    const agencyId = await trackEntityId({ type: EntityType.PUBLIC_AUTHORITY, name: "Pubinst Testivirasto" });
    const rel = await db!.relationship.findFirst({
      where: { sourceEntityId: ministryId!, targetEntityId: agencyId!, relationshipType: "SUPERVISES" },
    });
    expect(rel).not.toBeNull();
    createdRels.push(rel!.id);
  });

  it("routes a weak-evidence role to AUTO_DETECTED (review lane), never a confirmed connection", async () => {
    const ctx = makeCtx();
    const fact: RoleAssignmentFact = {
      kind: "role",
      person: { type: EntityType.PERSON, name: "Pubinst Epäselvä Johtaja", jurisdiction: "FI" },
      organization: { type: EntityType.ORGANIZATION, name: "Pubinst Järjestö", jurisdiction: "FI" },
      role: "Toiminnanjohtaja",
      roleType: "NGO_LEADER",
      sourceType: "REPUTABLE_MEDIA",
      sourceName: "Testi sekundaarilähde",
      publisher: "Testi media",
      confidence: "MEDIUM",
      evidenceUrl: "https://example.fi/weak-role",
      extractionMethod: "deterministic-parser",
    };
    const res = await publishRoleAssignment(ctx, fact);
    expect(res.action).toBe("review");
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Pubinst Epäselvä Johtaja" });
    const pos = await db!.position.findFirst({ where: { personEntityId: personId! } });
    expect(pos!.verificationStatus).toBe("AUTO_DETECTED");
    await db!.position.deleteMany({ where: { id: pos!.id } });
  });
});