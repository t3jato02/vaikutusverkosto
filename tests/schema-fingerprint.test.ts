import { describe, it, expect } from "vitest";
import { checkSchema, assertSchema } from "@/lib/ingestion/schemaFingerprint";

describe("source schema-drift detection (C5 Phase 29)", () => {
  const FTS = ["Beneficiary country", "Name of beneficiary", "Beneficiary's contracted amount (EUR)"];

  it("passes when every required column is present (quote/case/space tolerant)", () => {
    const r = checkSchema({
      observed: ["Year", "beneficiary  country", "NAME OF BENEFICIARY", "Beneficiary’s contracted amount (EUR)", "City"],
      required: FTS,
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("flags a missing required column and never throws from checkSchema", () => {
    const r = checkSchema({ observed: ["Year", "Name of beneficiary", "City"], required: FTS });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("Beneficiary country");
  });

  it("assertSchema throws a clear, halting error on drift", () => {
    expect(() => assertSchema("EU FTS 2024", { observed: ["Year", "City"], required: FTS })).toThrow(
      /schema drift.*required field\(s\) missing.*Ingestion halted/s,
    );
  });

  it("fingerprint changes when the field set changes, stable when it does not", () => {
    const a = checkSchema({ observed: ["a", "b", "c"], required: [] }).fingerprint;
    const aReordered = checkSchema({ observed: ["c", "a", "b"], required: [] }).fingerprint;
    const b = checkSchema({ observed: ["a", "b", "c", "d"], required: [] }).fingerprint;
    expect(a).toBe(aReordered);
    expect(a).not.toBe(b);
  });
});
