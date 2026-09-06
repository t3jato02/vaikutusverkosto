// Network analytics on the evidence-backed graph only (Sprint C3).
//
// These are STRUCTURAL metrics. They describe how the selected network is
// connected — never a person's morality, legality or guilt. There is no
// "influence score", "corruption score" or "suspiciousness score".
//
// Five separate scopes; an entity can rank differently in each:
//   organisational  — MEMBER_OF / BOARD_MEMBER_OF / CHAIRS / EMPLOYED_BY / ...
//   funding         — FinancialFlow edges (all)
//   decision        — VOTED_* / PARTICIPATED / DECIDED + Decision links
//   ownership       — OWNS / BENEFICIAL_OWNER_OF / SHAREHOLDER_OF
//   international    — foreign FinancialFlow edges

import { createHash } from "node:crypto";
import type { Prisma, RelationshipType } from "@prisma/client";
import { db } from "@/lib/db";
import { publicVisibleWhere } from "@/lib/verification";

export type GraphScope = "organisational" | "funding" | "decision" | "ownership" | "international";
export type Temporal = "current" | "historical" | "all";

export const ALGORITHM_VERSION = "1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const REL_TYPES: Record<Exclude<GraphScope, "funding" | "international">, RelationshipType[]> = {
  organisational: [
    "MEMBER_OF", "FORMER_MEMBER_OF", "BOARD_MEMBER_OF", "CHAIRS", "EMPLOYED_BY",
    "APPOINTED_BY", "APPOINTED_TO", "ADVISER_TO", "SITS_IN", "PART_OF", "REPRESENTS",
  ],
  decision: ["VOTED_FOR", "VOTED_AGAINST", "ABSTAINED", "INTRODUCED", "SIGNED", "DECIDED"],
  ownership: ["OWNS", "BENEFICIAL_OWNER_OF", "SHAREHOLDER_OF", "INVESTED_IN"],
};

export interface AnalyticsFilters {
  country?: string;
  fromYear?: number;
  toYear?: number;
  verifiedOnly?: boolean;
}

export interface NodeMetric {
  entityId: string;
  name: string;
  type: string;
  degree: number;
  weightedDegree: number;
  betweenness: number;
}

export interface AnalyticsResult {
  scope: GraphScope;
  temporal: Temporal;
  filters: AnalyticsFilters;
  algorithm: string;
  algorithmVersion: string;
  nodeCount: number;
  edgeCount: number;
  calculatedAt: string;
  cached: boolean;
  top: {
    byDegree: NodeMetric[];
    byWeightedDegree: NodeMetric[];
    byBetweenness: NodeMetric[];
  };
}

function scopeHash(scope: GraphScope, temporal: Temporal, filters: AnalyticsFilters): string {
  return createHash("sha256")
    .update(JSON.stringify({ scope, temporal, filters, v: ALGORITHM_VERSION }))
    .digest("hex");
}

// ---------------------------------------------------------------- graph load

interface Edge { a: string; b: string; weight: number }

async function loadEdges(scope: GraphScope, temporal: Temporal, filters: AnalyticsFilters): Promise<{ edges: Edge[]; maxUpdatedAt: Date }> {
  const edges: Edge[] = [];
  let maxUpdatedAt = new Date(0);

  const temporalRelWhere: Prisma.RelationshipWhereInput =
    temporal === "current" ? { temporalState: "CURRENT" } : temporal === "historical" ? { temporalState: "HISTORICAL" } : {};

  if (scope === "funding" || scope === "international") {
    const where: Prisma.FinancialFlowWhereInput = {
      ...publicVisibleWhere,
      ...(scope === "international" ? { isForeign: true } : {}),
      ...(filters.country ? { funderCountryCode: filters.country.toUpperCase() } : {}),
      ...(filters.fromYear || filters.toYear
        ? { periodYear: { ...(filters.fromYear ? { gte: filters.fromYear } : {}), ...(filters.toYear ? { lte: filters.toYear } : {}) } }
        : {}),
      ...(filters.verifiedOnly !== false ? { verificationStatus: { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] } } : {}),
    };
    const flows = await db.financialFlow.findMany({
      where,
      select: { payerEntityId: true, recipientEntityId: true, intermediaryEntityId: true, amount: true, updatedAt: true },
      take: 20000,
    });
    for (const f of flows) {
      if (f.updatedAt > maxUpdatedAt) maxUpdatedAt = f.updatedAt;
      const amt = Number(f.amount) || 0;
      if (f.intermediaryEntityId) {
        edges.push({ a: f.payerEntityId, b: f.intermediaryEntityId, weight: amt });
        edges.push({ a: f.intermediaryEntityId, b: f.recipientEntityId, weight: amt });
      } else {
        edges.push({ a: f.payerEntityId, b: f.recipientEntityId, weight: amt });
      }
    }
    return { edges, maxUpdatedAt };
  }

  const rels = await db.relationship.findMany({
    where: {
      ...publicVisibleWhere,
      ...temporalRelWhere,
      relationshipType: { in: REL_TYPES[scope] },
    },
    select: { sourceEntityId: true, targetEntityId: true, updatedAt: true },
    take: 40000,
  });
  for (const r of rels) {
    if (r.updatedAt > maxUpdatedAt) maxUpdatedAt = r.updatedAt;
    edges.push({ a: r.sourceEntityId, b: r.targetEntityId, weight: 1 });
  }
  return { edges, maxUpdatedAt };
}

// ---------------------------------------------------------------- metrics

/** Brandes' betweenness centrality on an unweighted, undirected graph. */
function brandes(adj: Map<string, Set<string>>): Map<string, number> {
  const nodes = [...adj.keys()];
  const cb = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(nodes.map((n) => [n, []]));
    const sigma = new Map<string, number>(nodes.map((n) => [n, 0]));
    const dist = new Map<string, number>(nodes.map((n) => [n, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];
    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v) ?? []) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }
    const delta = new Map<string, number>(nodes.map((n) => [n, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }
  // Undirected: each pair counted twice.
  for (const n of nodes) cb.set(n, cb.get(n)! / 2);
  return cb;
}

function computeMetrics(edges: Edge[]): { degree: Map<string, number>; weighted: Map<string, number>; betweenness: Map<string, number> } {
  const degree = new Map<string, number>();
  const weighted = new Map<string, number>();
  const adj = new Map<string, Set<string>>();
  const touch = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set());
    if (!degree.has(id)) { degree.set(id, 0); weighted.set(id, 0); }
  };
  for (const e of edges) {
    if (e.a === e.b) continue;
    touch(e.a); touch(e.b);
    adj.get(e.a)!.add(e.b);
    adj.get(e.b)!.add(e.a);
    degree.set(e.a, degree.get(e.a)! + 1);
    degree.set(e.b, degree.get(e.b)! + 1);
    weighted.set(e.a, weighted.get(e.a)! + e.weight);
    weighted.set(e.b, weighted.get(e.b)! + e.weight);
  }
  // Betweenness is O(V*E); cap to keep it bounded.
  const betweenness = adj.size <= 4000 ? brandes(adj) : new Map<string, number>([...adj.keys()].map((n) => [n, 0]));
  return { degree, weighted, betweenness };
}

// ---------------------------------------------------------------- public API

export async function networkAnalytics(
  scope: GraphScope,
  temporal: Temporal = "current",
  filters: AnalyticsFilters = {},
): Promise<AnalyticsResult> {
  const hash = scopeHash(scope, temporal, filters);
  const cached = await db.networkAnalytics.findUnique({ where: { scopeHash: hash } });

  // Cache valid if fresh AND the graph hasn't changed since it was computed.
  if (cached && Date.now() - cached.calculatedAt.getTime() < CACHE_TTL_MS) {
    return { ...(cached.result as unknown as AnalyticsResult), cached: true, calculatedAt: cached.calculatedAt.toISOString() };
  }

  const { edges, maxUpdatedAt } = await loadEdges(scope, temporal, filters);
  if (cached && cached.graphMaxUpdatedAt >= maxUpdatedAt && Date.now() - cached.calculatedAt.getTime() < 7 * CACHE_TTL_MS) {
    return { ...(cached.result as unknown as AnalyticsResult), cached: true, calculatedAt: cached.calculatedAt.toISOString() };
  }

  const { degree, weighted, betweenness } = computeMetrics(edges);
  const ids = [...degree.keys()];
  const names = ids.length
    ? await db.entity.findMany({ where: { id: { in: ids } }, select: { id: true, canonicalName: true, type: true } })
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n]));
  const metric = (id: string): NodeMetric => ({
    entityId: id,
    name: nameMap.get(id)?.canonicalName ?? id.slice(0, 8),
    type: nameMap.get(id)?.type ?? "OTHER",
    degree: degree.get(id) ?? 0,
    weightedDegree: Math.round(weighted.get(id) ?? 0),
    betweenness: Number((betweenness.get(id) ?? 0).toFixed(2)),
  });
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => metric(id));

  const result: AnalyticsResult = {
    scope,
    temporal,
    filters,
    algorithm: "degree + weighted-degree + Brandes betweenness (undirected)",
    algorithmVersion: ALGORITHM_VERSION,
    nodeCount: degree.size,
    edgeCount: edges.length,
    calculatedAt: new Date().toISOString(),
    cached: false,
    top: { byDegree: top(degree), byWeightedDegree: top(weighted), byBetweenness: top(betweenness) },
  };

  await db.networkAnalytics.upsert({
    where: { scopeHash: hash },
    update: { result: result as unknown as Prisma.InputJsonValue, nodeCount: result.nodeCount, edgeCount: result.edgeCount, graphMaxUpdatedAt: maxUpdatedAt, calculatedAt: new Date(), algorithmVersion: ALGORITHM_VERSION, temporal, filters: filters as Prisma.InputJsonValue },
    create: { scope, scopeHash: hash, temporal, filters: filters as Prisma.InputJsonValue, algorithmVersion: ALGORITHM_VERSION, nodeCount: result.nodeCount, edgeCount: result.edgeCount, result: result as unknown as Prisma.InputJsonValue, graphMaxUpdatedAt: maxUpdatedAt },
  });
  return result;
}

/** Per-entity funding metrics — documented amounts only. */
export async function entityFundingMetrics(entityId: string) {
  const [incoming, outgoing] = await Promise.all([
    db.financialFlow.aggregate({ where: { recipientEntityId: entityId, ...publicVisibleWhere }, _sum: { amount: true }, _count: { _all: true } }),
    db.financialFlow.aggregate({ where: { payerEntityId: entityId, ...publicVisibleWhere }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const funders = await db.financialFlow.findMany({ where: { recipientEntityId: entityId, ...publicVisibleWhere }, select: { payerEntityId: true, funderCountryCode: true, projectId: true } });
  return {
    incomingDocumentedEur: Math.round(Number(incoming._sum.amount ?? 0)),
    outgoingDocumentedEur: Math.round(Number(outgoing._sum.amount ?? 0)),
    incomingRecords: incoming._count._all,
    outgoingRecords: outgoing._count._all,
    uniqueFunders: new Set(funders.map((f) => f.payerEntityId)).size,
    uniqueFunderCountries: new Set(funders.map((f) => f.funderCountryCode).filter(Boolean)).size,
    projects: new Set(funders.map((f) => f.projectId).filter(Boolean)).size,
  };
}
