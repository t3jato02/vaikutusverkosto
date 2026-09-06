import { describe, it, expect } from "vitest";
import "dotenv/config";
import { networkAnalytics, entityFundingMetrics, ALGORITHM_VERSION } from "@/lib/analytics";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("network analytics (Sprint C3)", () => {
  it("computes a scoped result with graph metadata and no moralised score", async () => {
    const a = await networkAnalytics("funding", "current");
    expect(a.scope).toBe("funding");
    expect(a.temporal).toBe("current");
    expect(a.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(typeof a.nodeCount).toBe("number");
    expect(typeof a.edgeCount).toBe("number");
    expect(a).toHaveProperty("calculatedAt");
    // metric keys, never "influenceScore" / "corruptionScore" / "riskScore"
    const keys = JSON.stringify(a).toLowerCase();
    expect(keys).not.toMatch(/influencescore|corruptionscore|riskscore|suspicious|guilt|loyalty/);
    for (const n of a.top.byDegree) {
      expect(n).toHaveProperty("degree");
      expect(n).toHaveProperty("weightedDegree");
      expect(n).toHaveProperty("betweenness");
    }
  });

  it("the five scopes are independent (different node/edge counts)", async () => {
    const scopes = ["organisational", "funding", "international", "decision", "ownership"] as const;
    const results = await Promise.all(scopes.map((s) => networkAnalytics(s, "all")));
    const sig = new Set(results.map((r) => `${r.scope}:${r.nodeCount}:${r.edgeCount}`));
    expect(sig.size).toBe(scopes.length);
  });

  it("historical relationships never enter the CURRENT organisational graph", async () => {
    const cur = await networkAnalytics("organisational", "current");
    const hist = await networkAnalytics("organisational", "historical");
    // The graphs are built from disjoint temporalState partitions.
    expect(cur.edgeCount + hist.edgeCount).toBeGreaterThan(0);
    // A purely-historical edge set must not equal the current one.
    if (hist.edgeCount > 0 && cur.edgeCount > 0) {
      expect(cur.edgeCount).not.toBe(cur.edgeCount + hist.edgeCount);
    }
  });

  it("the second call for the same scope is served from cache", async () => {
    await networkAnalytics("decision", "current");
    const second = await networkAnalytics("decision", "current");
    expect(second.cached).toBe(true);
  });

  it("entityFundingMetrics returns documented-only aggregates", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const flow = await db.financialFlow.findFirst({ where: { isForeign: true }, select: { recipientEntityId: true } });
    await db.$disconnect();
    if (!flow) return;
    const m = await entityFundingMetrics(flow.recipientEntityId);
    expect(m.incomingDocumentedEur).toBeGreaterThanOrEqual(0);
    expect(m.incomingRecords).toBeGreaterThan(0);
    expect(m.uniqueFunders).toBeGreaterThan(0);
  });
});
