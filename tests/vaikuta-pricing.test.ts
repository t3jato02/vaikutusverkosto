import { describe, it, expect } from "vitest";
import { activePlans, planConfig, pricingVersion, PRICE_PASS_MINOR, PLANS } from "@/lib/vaikuta/pricing";
import { eurToMinor, minorToEur, formatMinor, sanitizeMinor } from "@/lib/vaikuta/money";

describe("VAIKUTA pricing config (section 7)", () => {
  it("stores every price in integer minor units — no floats anywhere", () => {
    for (const plan of activePlans()) {
      expect(Number.isInteger(plan.priceMinor)).toBe(true);
      expect(plan.priceMinor).toBeGreaterThanOrEqual(0);
    }
    expect(PRICE_PASS_MINOR).toBe(1490); // €14.90
    expect(PLANS.VAIKUTA_PLUS.priceMinor).toBe(2490);
    expect(PLANS.VAIKUTA_PRO.priceMinor).toBe(5900);
    expect(PLANS.ORGANIZATION.priceMinor).toBe(19900);
  });

  it("FREE is browse/draft only (allowance 0)", () => {
    expect(planConfig("FREE").campaignAllowance).toBe(0);
    expect(planConfig("FREE").priceMinor).toBe(0);
  });

  it("unknown plan code falls back to FREE", () => {
    expect(planConfig("NOPE").code).toBe("FREE");
  });

  it("activePlans lists the tiers deterministically", () => {
    const codes = activePlans().map((p) => p.code);
    expect(codes).toEqual(["FREE", "VAIKUTA_PASS", "VAIKUTA_PLUS", "VAIKUTA_PRO", "ORGANIZATION"]);
  });

  it("pricingVersion is stable and derived from config", () => {
    expect(pricingVersion()).toMatch(/^v1-/);
    expect(pricingVersion()).toBe(pricingVersion());
  });
});

describe("money helpers (never floats for money)", () => {
  it("converts eur <-> minor units correctly", () => {
    expect(eurToMinor(14.9)).toBe(1490);
    expect(minorToEur(1490)).toBe(14.9);
    expect(minorToEur(2490)).toBe(24.9);
  });

  it("formats minor units as Finnish currency", () => {
    expect(formatMinor(1490)).toContain("14,90");
    expect(formatMinor(0)).toContain("0,00");
  });

  it("rejects invalid client-supplied money values", () => {
    expect(sanitizeMinor(14.5)).toBeNull();
    expect(sanitizeMinor(NaN)).toBeNull();
    expect(sanitizeMinor(-5)).toBeNull();
    expect(sanitizeMinor(Infinity)).toBeNull();
    expect(sanitizeMinor(1490)).toBe(1490);
  });
});