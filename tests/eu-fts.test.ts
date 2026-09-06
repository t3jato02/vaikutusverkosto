import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { euFtsAdapter } from "@/lib/agents/euFts";
import type { RunContext } from "@/lib/agents/types";
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
    expect(f.startDate).toBeInstanceOf(Date);
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
