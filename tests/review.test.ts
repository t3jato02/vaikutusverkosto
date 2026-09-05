import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { reviewRelationship, reviewResolutionCandidate } from "@/lib/review";
import { db } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const TAG = `review-test-${Date.now()}`;

async function mkRel(status: "AUTO_DETECTED" | "DISPUTED" = "AUTO_DETECTED") {
  const a = await db.entity.create({ data: { type: "ORGANIZATION", canonicalName: `${TAG}-A`, jurisdiction: "FI" } });
  const b = await db.entity.create({ data: { type: "ORGANIZATION", canonicalName: `${TAG}-B`, jurisdiction: "FI" } });
  const r = await db.relationship.create({
    data: {
      sourceEntityId: a.id,
      targetEntityId: b.id,
      relationshipType: "MEMBER_OF",
      verificationStatus: status,
      confidenceScore: 0.5,
      createdBy: "test-agent",
    },
  });
  return { r, a, b };
}

describe.skipIf(!hasDb)("human review actions (Phase 12)", () => {
  afterAll(async () => {
    await db.reviewAction.deleteMany({ where: { note: TAG } });
    await db.relationship.deleteMany({ where: { sourceEntity: { canonicalName: { startsWith: TAG } } } });
    await db.changeLog.deleteMany({ where: { description: { contains: "Tarkastajan toimenpide" }, entity: { canonicalName: { startsWith: TAG } } } });
    await db.entity.deleteMany({ where: { canonicalName: { startsWith: TAG } } });
    await db.entityResolutionCandidate.deleteMany({ where: { refName: `${TAG}-cand` } });
  });

  it("approve → HUMAN_VERIFIED + audit + changelog, createdBy human", async () => {
    const { r } = await mkRel();
    const res = await reviewRelationship(r.id, "approve", TAG);
    expect(res.ok).toBe(true);
    const after = await db.relationship.findUnique({ where: { id: r.id } });
    expect(after?.verificationStatus).toBe("HUMAN_VERIFIED");
    expect(after?.createdBy).toBe("human");
    const audit = await db.reviewAction.findFirst({ where: { targetId: r.id, action: "approve" } });
    expect(audit?.targetType).toBe("relationship");
    const cl = await db.changeLog.findFirst({ where: { relationshipId: r.id } });
    expect(cl).toBeTruthy();
  });

  it("reject / dispute / stale map to the right status", async () => {
    for (const [action, status] of [
      ["reject", "REJECTED"],
      ["dispute", "DISPUTED"],
      ["stale", "STALE"],
    ] as const) {
      const { r } = await mkRel();
      await reviewRelationship(r.id, action, TAG);
      const after = await db.relationship.findUnique({ where: { id: r.id } });
      expect(after?.verificationStatus).toBe(status);
    }
  });

  it("relationship review on a missing id fails cleanly", async () => {
    const res = await reviewRelationship("00000000-0000-0000-0000-000000000000", "approve");
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("resolution candidate: resolve requires one of its own candidate ids", async () => {
    const a = await db.entity.create({ data: { type: "PERSON", canonicalName: `${TAG}-P1`, jurisdiction: "FI" } });
    const b = await db.entity.create({ data: { type: "PERSON", canonicalName: `${TAG}-P2`, jurisdiction: "FI" } });
    const cand = await db.entityResolutionCandidate.create({
      data: { refName: `${TAG}-cand`, refType: "PERSON", candidateEntityIds: [a.id, b.id] },
    });
    const bad = await reviewResolutionCandidate(cand.id, "resolve", "not-a-candidate");
    expect(bad).toEqual({ ok: false, error: "invalid_entity" });
    const good = await reviewResolutionCandidate(cand.id, "resolve", b.id, TAG);
    expect(good.ok).toBe(true);
    const after = await db.entityResolutionCandidate.findUnique({ where: { id: cand.id } });
    expect(after?.status).toBe("RESOLVED");
    expect(after?.resolvedEntityId).toBe(b.id);
    // second action is rejected
    const again = await reviewResolutionCandidate(cand.id, "dismiss");
    expect(again).toEqual({ ok: false, error: "already_resolved" });
  });
});
