// Human review actions (Phase 12). Every action writes an immutable
// ReviewAction row; relationship status changes also write a ChangeLog entry.
// An agent can never reach these — they are admin-only (middleware-guarded).

import type { VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { confidenceToScore } from "@/lib/verification";
import { deriveTemporalState } from "@/lib/temporal";

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
        description: `review:${action}:${next}:${rel.relationshipType}`,
        beforeData: before,
        afterData: { verificationStatus: next, action, relationshipType: rel.relationshipType },
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

// ---------------------------------------------------------------- candidates

export async function promoteCandidate(
  candidateId: string,
  note?: string,
): Promise<{ ok: true; relationshipId: string } | { ok: false; error: string }> {
  const c = await db.relationshipCandidate.findUnique({ where: { id: candidateId } });
  if (!c) return { ok: false, error: "not_found" };
  if (c.status !== "PENDING" && c.status !== "NEEDS_REVIEW" && c.status !== "AUTO_ACCEPTABLE") {
    return { ok: false, error: "already_resolved" };
  }
  if (!c.resolvedSourceEntityId || !c.resolvedTargetEntityId) {
    return { ok: false, error: "entities_unresolved" };
  }
  if (c.resolvedSourceEntityId === c.resolvedTargetEntityId) {
    return { ok: false, error: "self_relationship" };
  }

  // Dedupe against an existing published relationship — attach evidence instead
  // of creating a duplicate edge.
  const existing = await db.relationship.findFirst({
    where: {
      sourceEntityId: c.resolvedSourceEntityId,
      targetEntityId: c.resolvedTargetEntityId,
      relationshipType: c.relationshipType,
      role: c.role,
    },
    select: { id: true },
  });

  const source = await db.source.upsert({
    where: { sourceUrl: c.evidenceUrl },
    update: { lastCheckedAt: new Date() },
    create: {
      sourceUrl: c.evidenceUrl,
      sourceName: c.sourceName,
      publisher: c.publisher,
      sourceType: c.sourceType,
      documentTitle: c.evidenceTitle,
    },
  });

  let relationshipId: string;
  if (existing) {
    await db.evidence.create({
      data: { relationshipId: existing.id, sourceId: source.id, documentTitle: c.evidenceTitle, confidence: "HIGH" },
    });
    await db.relationship.update({
      where: { id: existing.id },
      data: { verificationStatus: "HUMAN_VERIFIED", createdBy: "human", lastVerifiedAt: new Date(), lastConfirmedAt: new Date() },
    });
    relationshipId = existing.id;
  } else {
    const temporalState = deriveTemporalState({
      validFrom: c.proposedValidFrom,
      validTo: c.proposedValidTo,
      status: "ACTIVE",
    });
    const rel = await db.relationship.create({
      data: {
        sourceEntityId: c.resolvedSourceEntityId,
        targetEntityId: c.resolvedTargetEntityId,
        relationshipType: c.relationshipType,
        role: c.role,
        startDate: c.proposedValidFrom,
        endDate: c.proposedValidTo,
        amount: c.amount,
        currency: c.currency,
        observedAt: new Date(),
        lastConfirmedAt: new Date(),
        temporalState,
        confidence: "HIGH",
        confidenceScore: c.confidenceScore ?? confidenceToScore("HIGH"),
        verificationState: "PUBLISHED",
        verificationStatus: "HUMAN_VERIFIED",
        createdBy: "human",
        lastVerifiedAt: new Date(),
        evidence: { create: [{ sourceId: source.id, documentTitle: c.evidenceTitle, confidence: "HIGH" }] },
      },
    });
    relationshipId = rel.id;
  }

  await db.$transaction([
    db.relationshipCandidate.update({
      where: { id: candidateId },
      data: { status: "ACCEPTED", publishedRelationshipId: relationshipId, reviewedAt: new Date(), reviewedBy: "admin" },
    }),
    db.reviewAction.create({
      data: {
        targetType: "relationship_candidate",
        targetId: candidateId,
        action: "approve",
        beforeData: { status: c.status },
        afterData: { status: "ACCEPTED", publishedRelationshipId: relationshipId },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
    db.changeLog.create({
      data: {
        eventType: "RELATIONSHIP_ADDED",
        entityId: c.resolvedSourceEntityId,
        relationshipId,
        description: `review:candidate-accepted:${c.relationshipType}`,
        afterData: { relationshipType: c.relationshipType, via: "candidate" },
        occurredAt: new Date(),
      },
    }),
  ]);
  return { ok: true, relationshipId };
}

export async function rejectCandidate(
  candidateId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db.relationshipCandidate.findUnique({ where: { id: candidateId }, select: { id: true, status: true } });
  if (!c) return { ok: false, error: "not_found" };
  await db.$transaction([
    db.relationshipCandidate.update({
      where: { id: candidateId },
      data: { status: "REJECTED", rejectionReason: reason?.slice(0, 500) ?? null, reviewedAt: new Date(), reviewedBy: "admin" },
    }),
    db.reviewAction.create({
      data: {
        targetType: "relationship_candidate",
        targetId: candidateId,
        action: "reject",
        beforeData: { status: c.status },
        afterData: { status: "REJECTED" },
        note: reason?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------- source conflicts

export async function resolveSourceConflict(
  conflictId: string,
  action: "resolve" | "dismiss",
  resolution?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db.sourceConflict.findUnique({ where: { id: conflictId }, select: { id: true, status: true } });
  if (!c) return { ok: false, error: "not_found" };
  await db.$transaction([
    db.sourceConflict.update({
      where: { id: conflictId },
      data: {
        status: action === "resolve" ? "RESOLVED" : "DISMISSED",
        resolution: resolution?.slice(0, 2000) ?? null,
        resolvedBy: "admin",
        resolvedAt: new Date(),
      },
    }),
    db.reviewAction.create({
      data: {
        targetType: "source_conflict",
        targetId: conflictId,
        action,
        beforeData: { status: c.status },
        afterData: { status: action === "resolve" ? "RESOLVED" : "DISMISSED" },
        note: resolution?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}
