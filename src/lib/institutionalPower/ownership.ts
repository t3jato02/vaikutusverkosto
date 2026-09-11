// Ownership / control graph (institutional-power foundation, section 4).
//
// Generic, temporal ownership edges between entities (STATE → COMPANY,
// MUNICIPALITY → COMPANY, COMPANY → SUBSIDIARY, FUND → COMPANY, …). The
// foundation operates on the OWNS-family Relationship edges (OWNS,
// SHAREHOLDER_OF, PARTIALLY_OWNS, BENEFICIAL_OWNER_OF, OWNS_MEDIA, OWNED_BY).
//
// HARD RULES
//   - A percentage is NEVER inferred: it is REPORTED by the source or
//     CALCULATED deterministically from stated data (share counts, ratios).
//   - Beneficial ownership is never assumed without evidence.
//   - An indirect stake is only reported when the ownership chain is itself
//     documented (≥ 2 consecutive ownership edges).
//   - Historical edges stay historical; they never count toward a current
//     control figure.

import type { RelationshipType } from "@prisma/client";

export interface OwnershipEdge {
  sourceEntityId: string;
  targetEntityId: string;
  percentage?: number | null; // 0-100
  isIndirect?: boolean;
  calculationStatus?: "REPORTED" | "CALCULATED" | "UNKNOWN" | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  /** Current = open-ended or still valid today. Null when undeterminable. */
  current?: boolean | null;
  sourceCount?: number;
}

export interface OwnershipPath {
  path: string[]; // ordered entity ids: [source, ..., target]
  edges: OwnershipEdge[];
  /** Cumulative percentage along the chain (product / 100^(n-1)); null when any
   *  hop lacks a documented percentage. */
  effectivePercentage: number | null;
  /** True when the path uses more than one consecutive ownership edge. */
  indirect: boolean;
}

const OWNERSHIP_TYPES = new Set<RelationshipType>([
  "OWNS",
  "SHAREHOLDER_OF",
  "BENEFICIAL_OWNER_OF",
  "OWNS_MEDIA",
]);

export function isOwnershipType(type: RelationshipType | string | undefined | null): boolean {
  return Boolean(type && OWNERSHIP_TYPES.has(type as RelationshipType));
}

/** A stored percentage must lie within [0, 100]. */
export function percentageInBounds(pct: number | null | undefined): boolean {
  if (pct === null || pct === undefined) return true; // unknown is allowed, not invalid
  return Number.isFinite(pct) && pct >= 0 && pct <= 100;
}

/** Cumulative percentage along an ordered chain of documented percentages. */
export function effectiveOwnershipPercent(chainPct: Array<number | null | undefined>): number | null {
  if (chainPct.length === 0) return null;
  const known = chainPct.map((p) => (p === null || p === undefined) ? null : Number(p));
  if (known.some((p) => p === null)) return null;
  let acc = 1.0;
  for (const p of known as number[]) {
    if (!Number.isFinite(p) || p < 0 || p > 100) return null;
    acc *= p / 100;
  }
  // acc = Π(pᵢ)/100ⁿ → cumulative % = Π(pᵢ)/100ⁿ⁻¹ = acc × 100.
  return Math.round(acc * 100 * 100) / 100;
}

/**
 * Expand all documented ownership paths from `fromEntityId`, following
 * OWNS-family edges (direction: owner → owned). Only current edges are
 * traversed for a "current" expansion; pass `current: null` to include edges of
 * unknown currency. Historical edges (validTo in the past) are never traversed
 * for a current figure. Cycles are cut at maxDepth.
 */
export function expandOwnershipChain(
  edges: OwnershipEdge[],
  fromEntityId: string,
  opts: { maxDepth?: number; includeUnknownPeriod?: boolean } = {},
): OwnershipPath[] {
  const maxDepth = opts.maxDepth ?? 10;
  const bySource = new Map<string, OwnershipEdge[]>();
  for (const e of edges) {
    if (e.current === false) continue; // historical never counts as current control
    if (e.current === null && !opts.includeUnknownPeriod) continue;
    const list = bySource.get(e.sourceEntityId) ?? [];
    list.push(e);
    bySource.set(e.sourceEntityId, list);
  }

  const results: OwnershipPath[] = [];
  const visit = (node: string, path: string[], edgePath: OwnershipEdge[], depth: number) => {
    if (depth > maxDepth) return;
    const outgoing = bySource.get(node) ?? [];
    for (const e of outgoing) {
      if (path.includes(e.targetEntityId)) continue; // cut cycles
      const nextPath = [...path, e.targetEntityId];
      const nextEdges = [...edgePath, e];
      results.push({
        path: nextPath,
        edges: nextEdges,
        effectivePercentage: effectiveOwnershipPercent(nextEdges.map((x) => x.percentage)),
        indirect: nextEdges.length > 1,
      });
      visit(e.targetEntityId, nextPath, nextEdges, depth + 1);
    }
  };
  visit(fromEntityId, [fromEntityId], [], 0);
  return results;
}

/**
 * The documented direct ownership stake `ownerEntityId` holds in
 * `targetEntityId`, or null when no current ownership edge is documented.
 * Never synthesises an indirect figure from missing data.
 */
export function directOwnershipStake(edges: OwnershipEdge[], ownerEntityId: string, targetEntityId: string): OwnershipEdge | null {
  for (const e of edges) {
    if (e.sourceEntityId === ownerEntityId && e.targetEntityId === targetEntityId && e.current !== false) return e;
  }
  return null;
}