// Deterministic temporal state for a relationship (B.5 Phase 4).
// startDate = validFrom, endDate = validTo.
//
//   endDate in the past, OR status FORMER/INACTIVE               → HISTORICAL
//   endDate in the future/absent AND source asserts an active role → CURRENT
//   otherwise (open-ended, activity not confirmable)             → UNKNOWN_PERIOD
//
// A historical relationship is never surfaced as current. History is never
// deleted just because it ended.

import type { EntityStatus, TemporalState } from "@prisma/client";

export interface TemporalInput {
  validFrom?: Date | null;
  validTo?: Date | null;
  status?: EntityStatus | null;
  /** The source explicitly asserts this is an active, present-day role. */
  assertedCurrent?: boolean;
}

export function deriveTemporalState(input: TemporalInput, now: Date = new Date()): TemporalState {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (input.validTo && input.validTo < today) return "HISTORICAL";
  if (input.status === "FORMER" || input.status === "INACTIVE") return "HISTORICAL";
  if (input.validTo && input.validTo >= today) return "CURRENT";

  // Open-ended (no validTo).
  if (input.assertedCurrent) return "CURRENT";
  if (input.status === "ACTIVE" && input.assertedCurrent !== false) return "CURRENT";
  return "UNKNOWN_PERIOD";
}

/** Validity-window sanity: validTo must not precede validFrom. */
export function isValidWindow(input: TemporalInput): boolean {
  if (input.validFrom && input.validTo) return input.validTo >= input.validFrom;
  return true;
}

/** A CURRENT relationship must not carry a validTo in the past. */
export function temporalConsistent(state: TemporalState, input: TemporalInput, now: Date = new Date()): boolean {
  if (!isValidWindow(input)) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (state === "CURRENT" && input.validTo && input.validTo < today) return false;
  if (state === "HISTORICAL" && input.validTo && input.validTo >= today && input.status === "ACTIVE") return false;
  return true;
}

export const CURRENT_ONLY: { temporalState: TemporalState } = { temporalState: "CURRENT" };
