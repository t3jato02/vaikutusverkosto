// A7 verification model — shared semantics for status + confidence score.
// Publication policy (Phase 5):
//   default public views:  SOURCE_CONFIRMED, HUMAN_VERIFIED  → shown as normal
//                          DISPUTED, STALE                    → shown, clearly flagged
//                          AUTO_DETECTED, REJECTED            → NOT shown as a confirmed connection
//   admin views:           everything.

import type { Confidence, VerificationStatus, Prisma } from "@prisma/client";

/** Statuses a public visitor may see at all. */
export const PUBLIC_VISIBLE_STATUSES: VerificationStatus[] = [
  "SOURCE_CONFIRMED",
  "HUMAN_VERIFIED",
  "DISPUTED",
  "STALE",
];

/** Statuses shown without a caveat (a "confirmed connection"). */
export const CONFIRMED_STATUSES: VerificationStatus[] = ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"];

/** Statuses shown only with a visible caveat badge. */
export const FLAGGED_STATUSES: VerificationStatus[] = ["DISPUTED", "STALE"];

export function isPubliclyVisible(s: VerificationStatus): boolean {
  return PUBLIC_VISIBLE_STATUSES.includes(s);
}
export function isConfirmed(s: VerificationStatus): boolean {
  return CONFIRMED_STATUSES.includes(s);
}
export function isFlagged(s: VerificationStatus): boolean {
  return FLAGGED_STATUSES.includes(s);
}

/** Prisma `where` fragment for public relationship / flow queries. */
export const publicVisibleWhere: { verificationStatus: { in: VerificationStatus[] } } = {
  verificationStatus: { in: PUBLIC_VISIBLE_STATUSES },
};

/** Compose the public filter with an existing where clause. */
export function withPublicVisible<T extends Prisma.RelationshipWhereInput | Prisma.FinancialFlowWhereInput>(
  where: T,
): T {
  return { ...where, verificationStatus: { in: PUBLIC_VISIBLE_STATUSES } };
}

// ---------------------------------------------------------------- confidence score

const SCORE_BY_CONFIDENCE: Record<Confidence, number> = {
  VERIFIED: 0.95,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
  DISPUTED: 0.3,
};

/** Legacy confidence bucket → representative 0..1 score. Not a recomputed proof. */
export function confidenceToScore(c: Confidence): number {
  return SCORE_BY_CONFIDENCE[c] ?? 0.5;
}

// ---------------------------------------------------------------- status derivation (agents)

const SOURCE_CONFIRMED_TYPES = new Set([
  "OFFICIAL_PRIMARY",
  "OFFICIAL_REGISTER",
  "PARLIAMENTARY_RECORD",
  "COURT_DOCUMENT",
  "COMPANY_DISCLOSURE",
  "PROCUREMENT_RECORD",
  "ORGANIZATION_DISCLOSURE",
]);

/**
 * Status for a fact an agent is about to publish.
 * An agent may only ever produce AUTO_DETECTED or SOURCE_CONFIRMED — never
 * HUMAN_VERIFIED (that requires a human reviewer, Phase 5).
 */
export function deriveAgentStatus(input: {
  sourceType: string;
  confidence: Confidence;
}): Extract<VerificationStatus, "AUTO_DETECTED" | "SOURCE_CONFIRMED"> {
  const strongSource = SOURCE_CONFIRMED_TYPES.has(input.sourceType);
  const strongConfidence = input.confidence === "VERIFIED" || input.confidence === "HIGH";
  return strongSource && strongConfidence ? "SOURCE_CONFIRMED" : "AUTO_DETECTED";
}
