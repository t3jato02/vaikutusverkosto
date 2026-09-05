// Human review actions (Phase 12). Every action writes an immutable
// ReviewAction row; relationship status changes also write a ChangeLog entry.
// An agent can never reach these — they are admin-only (middleware-guarded).

import type { VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type RelationshipReviewAction = "approve" | "reject" | "dispute" | "stale";

const STATUS_BY_ACTION: Record<RelationshipReviewAction, VerificationStatus> = {
  approve: "HUMAN_VERIFIED",
  reject: "REJECTED",
  dispute: "DISPUTED",
  stale: "STALE",
};

export async function reviewRelationship(
  relationshipId: string,
  action: RelationshipReviewAction,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rel = await db.relationship.findUnique({
    where: { id: relationshipId },
    select: { id: true, verificationStatus: true, sourceEntityId: true, relationshipType: true },
  });
  if (!rel) return { ok: false, error: "not_found" };

  const next = STATUS_BY_ACTION[action];
  const before = { verificationStatus: rel.verificationStatus };

  await db.$transaction([
    db.relationship.update({
      where: { id: relationshipId },
      data: {
        verificationStatus: next,
        lastVerifiedAt: new Date(),
        createdBy: "human",
      },
    }),
    db.reviewAction.create({
      data: {
        targetType: "relationship",
        targetId: relationshipId,
        action,
        beforeData: before,
        afterData: { verificationStatus: next },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
    db.changeLog.create({
      data: {
        eventType: action === "reject" ? "RELATIONSHIP_ENDED" : "RELATIONSHIP_ADDED",
        entityId: rel.sourceEntityId,
        relationshipId,
        description: `Tarkastajan toimenpide: ${action} → ${next} (${rel.relationshipType})`,
        beforeData: before,
        afterData: { verificationStatus: next },
        occurredAt: new Date(),
      },
    }),
  ]);
  return { ok: true };
}

export type CandidateReviewAction = "resolve" | "dismiss";

export async function reviewResolutionCandidate(
  candidateId: string,
  action: CandidateReviewAction,
  resolvedEntityId?: string,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cand = await db.entityResolutionCandidate.findUnique({ where: { id: candidateId } });
  if (!cand) return { ok: false, error: "not_found" };
  if (cand.status !== "PENDING") return { ok: false, error: "already_resolved" };

  if (action === "resolve") {
    if (!resolvedEntityId || !cand.candidateEntityIds.includes(resolvedEntityId)) {
      return { ok: false, error: "invalid_entity" };
    }
  }

  await db.$transaction([
    db.entityResolutionCandidate.update({
      where: { id: candidateId },
      data: {
        status: action === "resolve" ? "RESOLVED" : "DISMISSED",
        resolvedEntityId: action === "resolve" ? resolvedEntityId : null,
        resolvedBy: "admin",
        resolvedAt: new Date(),
      },
    }),
    db.reviewAction.create({
      data: {
        targetType: "resolution_candidate",
        targetId: candidateId,
        action,
        beforeData: { status: cand.status },
        afterData: { status: action === "resolve" ? "RESOLVED" : "DISMISSED", resolvedEntityId: resolvedEntityId ?? null },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}

export async function reviewCorrection(
  correctionId: string,
  action: "investigate" | "resolve" | "dismiss" | "dispute",
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db.correction.findUnique({ where: { id: correctionId }, select: { id: true, status: true } });
  if (!c) return { ok: false, error: "not_found" };
  const nextStatus =
    action === "investigate" ? "UNDER_REVIEW" : action === "resolve" ? "ACCEPTED" : action === "dismiss" ? "REJECTED" : "UNDER_REVIEW";
  await db.$transaction([
    db.correction.update({
      where: { id: correctionId },
      data: { status: nextStatus, resolvedAt: action === "resolve" || action === "dismiss" ? new Date() : null },
    }),
    db.reviewAction.create({
      data: {
        targetType: "correction",
        targetId: correctionId,
        action,
        beforeData: { status: c.status },
        afterData: { status: nextStatus },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}
