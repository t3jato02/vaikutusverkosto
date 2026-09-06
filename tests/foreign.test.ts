import { describe, it, expect } from "vitest";
import "dotenv/config";
import { deriveIsForeign, buildForeignFundingWhere, foreignFundingOverview } from "@/lib/foreign";

describe("foreign funding helpers (Sprint C)", () => {
  it("deriveIsForeign: only a known non-FI funder country is foreign", () => {
    expect(deriveIsForeign("QA")).toBe(true);
    expect(deriveIsForeign("qa")).toBe(true);
    expect(deriveIsForeign("FI")).toBe(false);
    expect(deriveIsForeign(null)).toBe(false);
    expect(deriveIsForeign(undefined)).toBe(false);
    expect(deriveIsForeign("")).toBe(false);
  });

  it("buildForeignFundingWhere defaults to foreign + verified + public-visible", () => {
    const w = buildForeignFundingWhere({});
    expect(w.isForeign).toBe(true);
    expect(w.verificationStatus).toEqual({ in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] });
  });

  it("buildForeignFundingWhere honours explicit opt-outs and filters", () => {
    const w = buildForeignFundingWhere({ foreignOnly: false, verifiedOnly: false, country: "us", minAmount: 1000 });
    expect(w.isForeign).toBeUndefined();
    expect(w.funderCountryCode).toBe("US");
    expect((w.amount as { gte?: number }).gte).toBe(1000);
  });

  it.skipIf(!process.env.DATABASE_URL)("overview runs and returns a consistent shape", async () => {
    const o = await foreignFundingOverview();
    expect(typeof o.totalAmount).toBe("number");
    expect(typeof o.flowCount).toBe("number");
    expect(Array.isArray(o.byCountry)).toBe(true);
    expect(o.countries.length).toBeGreaterThan(0); // Country table seeded
    // No foreign data yet → honest zero.
    expect(o.totalAmount).toBeGreaterThanOrEqual(0);
  });
});
