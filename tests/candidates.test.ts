import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { recordRelationshipCandidate } from "@/lib/agents/candidates";
import { promoteCandidate, rejectCandidate } from "@/lib/review";
import { db } from "@/lib/db";
import type { ProposedFact } from "@/lib/agents/types";

const hasDb = !!process.env.DATABASE_URL;
const TAG = `cand-test-${Date.now()}`;

function fact(over: Partial<ProposedFact> = {}): ProposedFact {
  return {
    kind: "relationship",
    source: { type: "PERSON", name: `${TAG}-P` },
    target: { type: "ORGANIZATION", name: `${TAG}-O` },
    relationshipType: "BOARD_MEMBER_OF",
    confidence: "MEDIUM",
    evidenceUrl: `https://example.test/${TAG}`,
    evidenceTitle: "test doc",
    sourceType: "REPUTABLE_MEDIA",
    sourceName: "Test Media",
    publisher: "Test",
    extractionMethod: "llm",
    extractorVersion: "test-1",
    ...over,
  };
}

describe.skipIf(!hasDb)("RelationshipCandidate lane (B.5 Phase 3)", () => {
  afterAll(async () => {
    await db.reviewAction.deleteMany({ where: { note: TAG } });
    await db.relationshipCandidate.deleteMany({ where: { evidenceUrl: { contains: TAG } } });
    await db.evidence.deleteMany({ where: { source: { sourceUrl: { contains: TAG } } } });
    await db.relationship.deleteMany({ where: { sourceEntity: { canonicalName: { startsWith: TAG } } } });
    await db.source.deleteMany({ where: { sourceUrl: { contains: TAG } } });
    await db.entity.deleteMany({ where: { canonicalName: { startsWith: TAG } } });
  });

  it("records a candidate and dedupes a second identical one", async () => {
    const a = await db.entity.create({ data: { type: "PERSON", canonicalName: `${TAG}-P`, jurisdiction: "FI" } });
    const b = await db.entity.create({ data: { type: "ORGANIZATION", canonicalName: `${TAG}-O`, jurisdiction: "FI" } });
    const r1 = await recordRelationshipCandidate(db, { fact: fact(), resolvedSourceEntityId: a.id, resolvedTargetEntityId: b.id });
    expect(r1.deduped).toBe(false);
    const r2 = await recordRelationshipCandidate(db, { fact: fact(), resolvedSourceEntityId: a.id, resolvedTargetEntityId: b.id });
    expect(r2.deduped).toBe(true);
    expect(r2.candidateId).toBe(r1.candidateId);
    const row = await db.relationshipCandidate.findUnique({ where: { id: r1.candidateId } });
    expect(row?.status).toBe("NEEDS_REVIEW"); // llm → needs review
  });

  it("promote creates a HUMAN_VERIFIED relationship + evidence + audit; second promote fails", async () => {
    const a = await db.entity.create({ data: { type: "PERSON", canonicalName: `${TAG}-P2`, jurisdiction: "FI" } });
    const b = await db.entity.create({ data: { type: "ORGANIZATION", canonicalName: `${TAG}-O2`, jurisdiction: "FI" } });
    const { candidateId } = await recordRelationshipCandidate(db, {
      fact: fact({ source: { type: "PERSON", name: `${TAG}-P2` }, target: { type: "ORGANIZATION", name: `${TAG}-O2` } }),
      resolvedSourceEntityId: a.id,
      resolvedTargetEntityId: b.id,
    });
    const res = await promoteCandidate(candidateId, TAG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const rel = await db.relationship.findUnique({ where: { id: res.relationshipId }, include: { evidence: true } });
    expect(rel?.verificationStatus).toBe("HUMAN_VERIFIED");
    expect(rel?.createdBy).toBe("human");
    expect(rel?.evidence.length).toBeGreaterThan(0);
    expect(rel?.temporalState).toBeTruthy();
    const audit = await db.reviewAction.findFirst({ where: { targetId: candidateId, action: "approve" } });
    expect(audit?.targetType).toBe("relationship_candidate");
    const again = await promoteCandidate(candidateId);
    expect(again).toEqual({ ok: false, error: "already_resolved" });
  });

  it("promote refuses a self-relationship and unresolved entities", async () => {
    const a = await db.entity.create({ data: { type: "PERSON", canonicalName: `${TAG}-P3`, jurisdiction: "FI" } });
    const selfCand = await recordRelationshipCandidate(db, {
      fact: fact(),
      resolvedSourceEntityId: a.id,
      resolvedTargetEntityId: a.id,
    });
    expect(await promoteCandidate(selfCand.candidateId)).toEqual({ ok: false, error: "self_relationship" });
    const unresolved = await recordRelationshipCandidate(db, { fact: fact(), resolvedSourceEntityId: null, resolvedTargetEntityId: null });
    expect(await promoteCandidate(unresolved.candidateId)).toEqual({ ok: false, error: "entities_unresolved" });
  });

  it("reject marks REJECTED with a reason + audit", async () => {
    const r = await recordRelationshipCandidate(db, { fact: fact(), resolvedSourceEntityId: null, resolvedTargetEntityId: null });
    const res = await rejectCandidate(r.candidateId, "not credible");
    expect(res.ok).toBe(true);
    const row = await db.relationshipCandidate.findUnique({ where: { id: r.candidateId } });
    expect(row?.status).toBe("REJECTED");
    expect(row?.rejectionReason).toContain("not credible");
  });
});
