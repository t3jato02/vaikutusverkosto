import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { publishVerifiedFact } from "@/lib/agents/publish";
import { db } from "@/lib/db";
import type { ProposedFact, RunContext } from "@/lib/agents/types";

const hasDb = !!process.env.DATABASE_URL;
const TAG = `corrob-${Date.now()}`;

const ctx = {
  runId: "00000000-0000-0000-0000-000000000000",
  agentId: "test",
  sourceId: "",
  db,
  stats: { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 },
  log: () => {},
} as unknown as RunContext;

function fact(over: Partial<ProposedFact>): ProposedFact {
  return {
    kind: "relationship",
    source: { type: "PERSON", name: `${TAG}-P`, externalId: { provider: `${TAG}-idp`, identifier: "p1" } },
    target: { type: "ORGANIZATION", name: `${TAG}-O`, externalId: { provider: `${TAG}-idp`, identifier: "o1" } },
    relationshipType: "BOARD_MEMBER_OF",
    role: "jäsen",
    confidence: "VERIFIED",
    evidenceUrl: `https://a.example/${TAG}`,
    sourceType: "OFFICIAL_REGISTER",
    sourceName: "Source A",
    publisher: "A",
    extractionMethod: "deterministic-parser",
    ...over,
  };
}

describe.skipIf(!hasDb)("cross-source corroboration (B.5 Phase 7)", () => {
  afterAll(async () => {
    const rels = await db.relationship.findMany({
      where: { sourceEntity: { canonicalName: { startsWith: TAG } } },
      select: { id: true },
    });
    await db.sourceConflict.deleteMany({ where: { relationshipId: { in: rels.map((r) => r.id) } } });
    await db.evidence.deleteMany({ where: { source: { sourceUrl: { contains: TAG } } } });
    await db.relationship.deleteMany({ where: { sourceEntity: { canonicalName: { startsWith: TAG } } } });
    await db.changeLog.deleteMany({ where: { entity: { canonicalName: { startsWith: TAG } } } });
    await db.source.deleteMany({ where: { sourceUrl: { contains: TAG } } });
    await db.externalIdentifier.deleteMany({ where: { provider: `${TAG}-idp` } });
    await db.entity.deleteMany({ where: { canonicalName: { startsWith: TAG } } });
  });

  it("two sources for the same edge → one relationship, two evidence rows, supportingSourceCount 2", async () => {
    const r1 = await publishVerifiedFact(ctx, fact({}));
    expect(r1.action).toBe("created");
    const r2 = await publishVerifiedFact(
      ctx,
      fact({ evidenceUrl: `https://b.example/${TAG}`, sourceName: "Source B", publisher: "B" }),
    );
    expect(["unchanged", "updated"]).toContain(r2.action);

    const rels = await db.relationship.findMany({
      where: { sourceEntity: { canonicalName: `${TAG}-P` } },
      include: { evidence: true },
    });
    expect(rels.length).toBe(1);
    expect(rels[0].evidence.length).toBe(2);
    expect(rels[0].supportingSourceCount).toBe(2);
  });

  it("re-publishing from the same source does not add evidence", async () => {
    const before = await db.relationship.findFirst({
      where: { sourceEntity: { canonicalName: `${TAG}-P` } },
      include: { evidence: true },
    });
    await publishVerifiedFact(ctx, fact({ evidenceUrl: `https://a.example/${TAG}` }));
    const after = await db.relationship.findFirst({
      where: { sourceEntity: { canonicalName: `${TAG}-P` } },
      include: { evidence: true },
    });
    expect(after!.evidence.length).toBe(before!.evidence.length);
  });
});
