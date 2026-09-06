// Content-analysis engine tests — deterministic, recomputable, and safe by
// construction. Integration tests that require the live pilot corpus; they
// self-skip when the corpus has not been seeded (npm run ingest:media).

import { describe, it, expect } from "vitest";
import "dotenv/config";
import { db } from "@/lib/db";
import { computeCoverage, computeComparison, computeAndStoreAnalysis, scopeHash } from "@/lib/analysis/engine";
import { CONTENT_ANALYSIS_ALGORITHM } from "@/lib/analysis/engine";

async function findJournalist(name: string) {
  return db.entity.findFirst({ where: { canonicalName: name, type: "PERSON" }, select: { id: true, subtype: true } });
}

async function findOutlet(name: string) {
  return db.entity.findFirst({ where: { canonicalName: name, type: "MEDIA_ORGANIZATION" }, select: { id: true } });
}

describe("content analysis engine", () => {
  it("is deterministic (identical inputs => identical results)", async () => {
    const j = await findJournalist("Mikael Shepelenko");
    if (!j) return; // pilot corpus not seeded
    const a = await computeCoverage("JOURNALIST", j.id, {});
    const b = await computeCoverage("JOURNALIST", j.id, {});
    expect(a).toEqual(b);
    expect(a.algorithmVersion).toBe(CONTENT_ANALYSIS_ALGORITHM);
    expect(a.corpusSize).toBeGreaterThanOrEqual(1);
    // Results must carry the "this is not a political verdict" limitation.
    expect(a.limitations.join(" ")).toMatch(/ei osoita toimittajan henkilökohtaista/i);
  });

  it("computes party coverage from observed mentions (never a stance)", async () => {
    const o = await findOutlet("Iltalehti");
    if (!o) return;
    const r = await computeCoverage("MEDIA_OUTLET", o.id, {});
    const names = r.parties.map((p) => p.name);
    // The corpus includes an article titled "PS:n kansanedustaja kokoomusministerin kimpussa"
    // whose headline mentions both Perussuomalaiset and Kansallinen Kokoomus.
    expect(names).toContain("Perussuomalaiset");
    expect(names.some((n) => n.includes("Kokoomus"))).toBe(true);
    for (const p of r.parties) {
      expect(p.shareOfPoliticsPct).toBeGreaterThanOrEqual(0);
      expect(p.shareOfPoliticsPct).toBeLessThanOrEqual(100);
    }
  });

  it("scope hash is deterministic and differs per kind", () => {
    const base = { scope: "JOURNALIST", entityId: "x", periodStart: null as string | null, periodEnd: null as string | null, algorithmVersion: CONTENT_ANALYSIS_ALGORITHM };
    const h1 = scopeHash({ ...base, kind: "PARTY_COVERAGE" });
    const h2 = scopeHash({ ...base, kind: "PARTY_COVERAGE" });
    const h3 = scopeHash({ ...base, kind: "GENRE_DISTRIBUTION" });
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("comparison returns one item per requested entity, no winner", async () => {
    const a = await findJournalist("Mikael Shepelenko");
    const b = await findJournalist("Mika Koskinen");
    if (!a || !b) return;
    const rows = await computeComparison("JOURNALIST", [a.id, b.id], {});
    expect(rows.length).toBe(2);
    const names = rows.map((r) => r.entity.name);
    expect(names).toContain("Mikael Shepelenko");
    expect(names).toContain("Mika Koskinen");
  });

  it("computeAndStoreAnalysis persists a versioned snapshot (upsert by scopeHash)", async () => {
    const j = await findJournalist("Mikael Shepelenko");
    if (!j) return;
    const before = await db.contentAnalysis.count();
    const r = await computeAndStoreAnalysis("JOURNALIST", "COVERAGE_METRICS", j.id, {});
    const after = await db.contentAnalysis.count();
    expect(r.corpusSize).toBeGreaterThanOrEqual(1);
    expect(after).toBeGreaterThanOrEqual(before);
    // Second call must not create a duplicate (same scopeHash).
    await computeAndStoreAnalysis("JOURNALIST", "COVERAGE_METRICS", j.id, {});
    expect(await db.contentAnalysis.count()).toBe(after);
  });
});