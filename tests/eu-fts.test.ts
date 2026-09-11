import { describe, it, expect, afterAll, beforeAll } from "vitest";
import "dotenv/config";
import {
  euFtsAdapter,
  recordKey,
  ftsYearCached,
  cachedFtsDescriptors,
  persistFtsDescriptors,
  FTS_CACHE_MAX_AGE_MS,
  type FtsRecord,
} from "@/lib/agents/euFts";
import type { RunContext, SourceDocument } from "@/lib/agents/types";
import { ensureRegistrySource } from "@/lib/agents/sourceRegistry";
import { db } from "@/lib/db";

const ctx = { log: () => {}, stats: {} } as unknown as RunContext;
const doc = {
  id: "eu-fts:2023:JAG.1:JAG.1.1:1234567-8",
  url: "https://ec.europa.eu/budget/financial-transparency-system/download/2023_FTS_dataset_en.xlsx#x",
  title: "EU FTS 2023 — TEST OY",
  hash: "",
  meta: {},
};

function rec(over: Record<string, unknown> = {}) {
  return {
    year: 2023,
    lc: "JAG.1",
    budgetRef: "JAG.1.1",
    name: "TEST OY",
    vat: "FI12345678",
    ngo: "No",
    city: "HELSINKI FI",
    amount: 50000,
    expenseType: "Operational",
    projectId: "",
    acronym: "",
    subject: "101099693 - TESTACR - A Test Project Title",
    programme: "1.0.11 - Horizon Europe",
    dept: "EACEA",
    benefType: "Private Companies",
    start: 44956,
    end: 45686,
    contractType: "Action Grant",
    ...over,
  };
}

describe("EU FTS parser (Sprint C2)", () => {
  it("emits one evidenced foreign flow EC → Finnish beneficiary", async () => {
    const facts = await euFtsAdapter.parse(ctx, doc, rec());
    expect(facts.length).toBe(1);
    const f = facts[0];
    expect(f.kind).toBe("flow");
    expect(f.source.name).toBe("Euroopan komissio");
    expect(f.source.jurisdiction).toBe("EU");
    expect(f.target.name).toBe("TEST OY");
    expect(f.target.externalId).toEqual({ provider: "ytj", identifier: "1234567-8" }); // FI VAT → Y-tunnus
    expect(f.funderCountryCode).toBe("EU");
    expect(f.recipientCountryCode).toBe("FI");
    expect(f.amount).toBe(50000);
    expect(f.currency).toBe("EUR");
    expect(f.fundingType).toBe("GRANT");
    expect(f.extractionMethod).toBe("deterministic-parser");
    expect(f.evidenceUrl).toContain("financial-transparency-system");
    expect(f.externalRecordId).toBe(doc.id);
    expect(f.projectRef?.sourceIdentifier).toBe("eu:101099693");
    expect(f.projectRef?.name).toContain("TESTACR");
    expect(f.periodYear).toBe(2023);
    expect(f.periodStart).toBeInstanceOf(Date);
  });

  it("classifies the Finnish State beneficiary as GOVERNMENT_BODY / GOVERNMENT (Phase 18)", async () => {
    const [f] = await euFtsAdapter.parse(ctx, doc, rec({ name: "SUOMEN TASAVALTA*REPUBLIQUE DE FINLANDE REPUBLIC OF FINLAND", vat: "" }));
    expect(f.target.type).toBe("GOVERNMENT_BODY");
    expect(f.target.entityCategory).toBe("GOVERNMENT");
    // a normal company is unaffected
    const [g] = await euFtsAdapter.parse(ctx, doc, rec({ name: "TEST OY" }));
    expect(g.target.type).toBe("ORGANIZATION");
  });

  it("maps a service/advisory contract to PROCUREMENT", async () => {
    const facts = await euFtsAdapter.parse(ctx, doc, rec({ contractType: "Advisory: non-IT" }));
    expect(facts[0].fundingType).toBe("PROCUREMENT");
  });

  it("skips zero and negative amounts", async () => {
    expect(await euFtsAdapter.parse(ctx, doc, rec({ amount: 0 }))).toEqual([]);
    expect(await euFtsAdapter.parse(ctx, doc, rec({ amount: -5 }))).toEqual([]);
  });

  it("keeps the source's raw contract type verbatim", async () => {
    const [f] = await euFtsAdapter.parse(ctx, doc, rec({ contractType: "Action Grant" }));
    expect(f.rawFundingType).toBe("Action Grant");
  });

  it("registry metadata: OFFICIAL_REGISTER, EU, monthly", () => {
    expect(euFtsAdapter.sourceType).toBe("OFFICIAL_REGISTER");
    expect(euFtsAdapter.reliabilityTier).toBe("OFFICIAL_REGISTER");
    expect(euFtsAdapter.updateCadence).toBe("monthly");
  });

  it("cross-year dedup: recordKey embeds the year, so annual records never collide", () => {
    const base = rec() as unknown as FtsRecord;
    const k23 = recordKey({ ...base, year: 2023 });
    const k22 = recordKey({ ...base, year: 2022 });
    expect(k23).not.toBe(k22);
    expect(k23).toContain("eu-fts:2023:");
    expect(k22).toContain("eu-fts:2022:");
    // Two rows with no LC/budgetRef but different subjects → distinct keys.
    const noref = { ...base, lc: "", budgetRef: "" };
    expect(recordKey({ ...noref, subject: "Project A" })).not.toBe(recordKey({ ...noref, subject: "Project B" }));
    // Identical rows → identical key (stable).
    expect(recordKey({ ...noref, subject: "X" })).toBe(recordKey({ ...noref, subject: "X" }));
  });

  it("no award/payment date is invented — flowDate stays null, project period is kept", async () => {
    const [f] = await euFtsAdapter.parse(ctx, doc, rec());
    expect(f.startDate).toBeNull();
    expect(f.endDate).toBeNull();
    expect(f.periodStart).toBeInstanceOf(Date);
    expect(f.periodYear).toBe(2023);
  });
});

// Semantic-safety regression (Sprint C2 Phase 17): organisation funding must
// never become a direct person-funding edge.
describe.skipIf(!process.env.DATABASE_URL)("semantic safety: no synthesised person funding", () => {
  afterAll(async () => { /* read-only */ });
  it("no isForeign flow terminates on a PERSON entity", async () => {
    const bad = await db.financialFlow.count({
      where: { isForeign: true, recipientEntity: { type: "PERSON" } },
    });
    expect(bad).toBe(0);
  });
});

// Resumable discovery (Sprint C2 hotfix): discover() must not re-download the
// ~20 MB XLSX files every tick. It persists parsed descriptors once, then
// rebuilds the list from the DB on later ticks. Test year 2099 never collides
// with real ingested data.
describe.skipIf(!process.env.DATABASE_URL)("EU FTS resumable discovery", () => {
  const TEST_YEAR = 2099;
  const prefix = `eu-fts:${TEST_YEAR}:`;
  const mk = (n: number): SourceDocument => ({
    id: `${prefix}LC${n}:BR${n}:${1000000 + n}-1`,
    url: `https://ec.europa.eu/budget/financial-transparency-system/download/${TEST_YEAR}_FTS_dataset_en.xlsx#r${n}`,
    title: `EU FTS ${TEST_YEAR} — TEST BENEFICIARY ${n}`,
    publishedAt: null,
    hash: "",
    meta: { year: TEST_YEAR, name: `TEST BENEFICIARY ${n}`, amount: 1000 + n, contractType: "Action Grant" } as unknown,
  });
  const seed = [mk(1), mk(2), mk(3)];

  beforeAll(async () => {
    await ensureRegistrySource("eu-fts-agent");
    await db.sourceDocument.deleteMany({
      where: { ingestionSourceId: "eu-fts-agent", externalId: { startsWith: prefix } },
    });
  });
  afterAll(async () => {
    await db.sourceDocument.deleteMany({
      where: { ingestionSourceId: "eu-fts-agent", externalId: { startsWith: prefix } },
    });
  });

  it("persists descriptors and is idempotent (skipDuplicates)", async () => {
    const first = await persistFtsDescriptors(db, seed);
    expect(first).toBe(3);
    const second = await persistFtsDescriptors(db, seed);
    expect(second).toBe(0); // already present → no duplicates
    const rows = await db.sourceDocument.count({
      where: { ingestionSourceId: "eu-fts-agent", externalId: { startsWith: prefix } },
    });
    expect(rows).toBe(3);
  });

  it("persisted rows carry the sentinel hash and the parsed record in metadata", async () => {
    const row = await db.sourceDocument.findFirst({
      where: { ingestionSourceId: "eu-fts-agent", externalId: seed[0].id },
    });
    expect(row?.contentHash).toBe(""); // collector fills this on first processing
    expect(row?.processingStatus).toBe("PENDING");
    expect((row?.metadata as { meta?: { name?: string } } | null)?.meta?.name).toBe("TEST BENEFICIARY 1");
  });

  it("cachedFtsDescriptors rebuilds descriptors from the DB with no network", async () => {
    const docs = await cachedFtsDescriptors(db);
    const mine = docs.filter((d) => d.id.startsWith(prefix));
    expect(mine).toHaveLength(3);
    expect(mine.map((d) => d.id).sort()).toEqual(seed.map((d) => d.id).sort());
    expect((mine[0].meta as { name?: string }).name).toContain("TEST BENEFICIARY");
    expect(mine[0].url).toContain(`${TEST_YEAR}_FTS_dataset_en.xlsx`);
  });

  it("ftsYearCached: true for freshly persisted year, false once it ages past the window", async () => {
    expect(await ftsYearCached(db, TEST_YEAR)).toBe(true);
    // Age every row for this year just past the cadence window.
    const old = new Date(Date.now() - FTS_CACHE_MAX_AGE_MS - 60_000);
    await db.sourceDocument.updateMany({
      where: { ingestionSourceId: "eu-fts-agent", externalId: { startsWith: prefix } },
      data: { firstSeenAt: old },
    });
    expect(await ftsYearCached(db, TEST_YEAR)).toBe(false);
    // A year that was never ingested is not cached.
    expect(await ftsYearCached(db, 2098)).toBe(false);
  });
});
