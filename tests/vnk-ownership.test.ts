import { describe, it, expect } from "vitest";
import "dotenv/config";
import { vnkOwnershipAdapter } from "@/lib/agents/vnkOwnership";
import type { RunContext, NormalizedFact } from "@/lib/agents/types";

const ctx = { log: () => {}, stats: {} } as unknown as RunContext;

describe("VNK state ownership adapter (Sprint C4)", () => {
  it("discovers one document per state holding, all with an evidence URL", async () => {
    const docs = await vnkOwnershipAdapter.discover(ctx);
    expect(docs.length).toBeGreaterThanOrEqual(8);
    for (const d of docs) {
      expect(d.id).toMatch(/^vnk:/);
      expect(d.publishedAt).toBeInstanceOf(Date);
      expect((d.meta as { percent: number }).percent).toBeGreaterThan(0);
    }
    // year-stamped id → a new report never collides with the old one
    expect(docs[0].id).toContain(":2024-05-31");
  });

  it("emits a temporal, evidenced OWNS fact Suomen valtio → company with a percentage", async () => {
    const docs = await vnkOwnershipAdapter.discover(ctx);
    const solidium = docs.find((d) => (d.meta as { name: string }).name === "Solidium Oy")!;
    const [f] = (await vnkOwnershipAdapter.parse(ctx, solidium, solidium.meta)) as [NormalizedFact];
    expect(f.kind).toBe("relationship");
    expect(f.relationshipType).toBe("OWNS");
    expect(f.source.name).toBe("Suomen valtio");
    expect(f.source.externalId).toEqual({ provider: "vnk", identifier: "suomen-valtio" });
    expect(f.target.name).toBe("Solidium Oy");
    expect(f.target.entityCategory).toBe("STATE_OWNED_COMPANY");
    expect(f.ownershipPercent).toBe(100);
    expect(f.assertedCurrent).toBe(true);
    expect(f.extractionMethod).toBe("deterministic-parser");
    expect(f.evidenceUrl).toContain("julkaisut.valtioneuvosto.fi");
  });

  it("every holding percentage is within [0, 100]", async () => {
    const docs = await vnkOwnershipAdapter.discover(ctx);
    for (const d of docs) {
      const [f] = (await vnkOwnershipAdapter.parse(ctx, d, d.meta)) as [NormalizedFact];
      expect(f.ownershipPercent).toBeGreaterThan(0);
      expect(f.ownershipPercent).toBeLessThanOrEqual(100);
    }
  });

  it("registry metadata: OFFICIAL_PRIMARY, VNK, manual/monthly cadence", () => {
    expect(vnkOwnershipAdapter.sourceType).toBe("OFFICIAL_PRIMARY");
    expect(vnkOwnershipAdapter.reliabilityTier).toBe("OFFICIAL_PRIMARY");
    expect(vnkOwnershipAdapter.publisher).toContain("Valtioneuvoston kanslia");
  });
});
