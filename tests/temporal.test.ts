import { describe, it, expect } from "vitest";
import "dotenv/config";
import { deriveTemporalState, isValidWindow, temporalConsistent } from "@/lib/temporal";
import { PrismaClient } from "@prisma/client";

const NOW = new Date("2026-06-01T00:00:00Z");
const past = new Date("2020-01-01");
const future = new Date("2030-01-01");

describe("deriveTemporalState (B.5 Phase 4)", () => {
  it("past validTo → HISTORICAL", () => {
    expect(deriveTemporalState({ validTo: past, status: "ACTIVE" }, NOW)).toBe("HISTORICAL");
  });
  it("FORMER/INACTIVE status → HISTORICAL regardless of dates", () => {
    expect(deriveTemporalState({ validTo: null, status: "FORMER" }, NOW)).toBe("HISTORICAL");
    expect(deriveTemporalState({ validTo: future, status: "INACTIVE" }, NOW)).toBe("HISTORICAL");
  });
  it("future validTo → CURRENT", () => {
    expect(deriveTemporalState({ validTo: future, status: "ACTIVE" }, NOW)).toBe("CURRENT");
  });
  it("open-ended + active role → CURRENT", () => {
    expect(deriveTemporalState({ validTo: null, status: "ACTIVE" }, NOW)).toBe("CURRENT");
    expect(deriveTemporalState({ validTo: null, assertedCurrent: true }, NOW)).toBe("CURRENT");
  });
  it("open-ended + activity not confirmable → UNKNOWN_PERIOD", () => {
    expect(deriveTemporalState({ validTo: null, assertedCurrent: false }, NOW)).toBe("UNKNOWN_PERIOD");
    expect(deriveTemporalState({ validTo: null, status: null }, NOW)).toBe("UNKNOWN_PERIOD");
  });
  it("a historical relationship is never CURRENT", () => {
    for (const status of ["FORMER", "INACTIVE"] as const) {
      expect(deriveTemporalState({ validTo: past, status }, NOW)).not.toBe("CURRENT");
    }
  });
});

describe("temporal consistency helpers", () => {
  it("isValidWindow rejects validTo < validFrom", () => {
    expect(isValidWindow({ validFrom: future, validTo: past })).toBe(false);
    expect(isValidWindow({ validFrom: past, validTo: future })).toBe(true);
    expect(isValidWindow({ validFrom: past, validTo: null })).toBe(true);
  });
  it("temporalConsistent flags CURRENT with a past validTo", () => {
    expect(temporalConsistent("CURRENT", { validTo: past }, NOW)).toBe(false);
    expect(temporalConsistent("HISTORICAL", { validTo: past }, NOW)).toBe(true);
    expect(temporalConsistent("CURRENT", { validTo: future }, NOW)).toBe(true);
  });
});

const hasDb = !!process.env.DATABASE_URL;
describe.skipIf(!hasDb)("temporal DB invariants", () => {
  const db = new PrismaClient();
  it("no CURRENT relationship has a past validTo (endDate)", async () => {
    const bad = await db.relationship.count({
      where: { temporalState: "CURRENT", endDate: { lt: new Date() } },
    });
    expect(bad).toBe(0);
  });
  it("every relationship has a temporalState", async () => {
    const total = await db.relationship.count();
    const withState = await db.relationship.count({
      where: { temporalState: { in: ["CURRENT", "HISTORICAL", "UNKNOWN_PERIOD"] } },
    });
    expect(withState).toBe(total);
  });
});
