import { describe, it, expect } from "vitest";
import {
  institutionalPower,
  networkCentrality,
  boardReach,
  appointmentReach,
  financialNetwork,
  dataConfidence,
  computeTier,
  type PersonMetricInput,
} from "@/lib/metrics";

function baseInput(overrides: Partial<PersonMetricInput> = {}): PersonMetricInput {
  return {
    positions: [],
    relationships: [],
    incomingFlows: [],
    outgoingFlows: [],
    sources: 0,
    ...overrides,
  };
}

describe("institutionalPower", () => {
  it("weights current positions over former", () => {
    const m = institutionalPower(baseInput({ positions: [{ role: "MP", isCurrent: true }, { role: "Minister", isCurrent: true }, { role: "Former", isCurrent: false }] }));
    expect(m.value).toBe(2.5);
    expect(m.methodologyVersion).toBeDefined();
    expect(m.interpretation).toBeTruthy();
  });

  it("is zero without positions", () => {
    expect(institutionalPower(baseInput()).value).toBe(0);
  });
});

describe("networkCentrality", () => {
  it("computes degree centrality", () => {
    const rels = [
      { type: "MEMBER_OF" as const, confidence: "VERIFIED" as const, startDate: null, endDate: null, amount: null },
      { type: "BOARD_MEMBER_OF" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
    ];
    const m = networkCentrality(rels, 11);
    expect(m.value).toBe(0.2);
    expect(m.inputs.degree).toBe(2);
  });

  it("normalizes by network size", () => {
    expect(networkCentrality([], 1).value).toBe(0);
    expect(networkCentrality([], 5).value).toBe(0);
  });
});

describe("boardReach / appointmentReach", () => {
  it("counts board memberships", () => {
    const m = boardReach(baseInput({
      relationships: [
        { type: "BOARD_MEMBER_OF" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
        { type: "CHAIRS" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
        { type: "MEMBER_OF" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
      ],
    }));
    expect(m.value).toBe(2);
  });

  it("counts appointments", () => {
    const m = appointmentReach(baseInput({
      relationships: [
        { type: "APPOINTED_TO" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
        { type: "APPOINTED_BY" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
      ],
    }));
    expect(m.value).toBe(2);
  });
});

describe("financialNetwork", () => {
  it("sums confidence-weighted flows", () => {
    const m = financialNetwork(baseInput({
      incomingFlows: [
        { amount: 1000, confidence: "VERIFIED" as const, flowType: "PUBLIC_GRANT" },
        { amount: 1000, confidence: "LOW" as const, flowType: "PUBLIC_GRANT" },
      ],
    }));
    expect(m.value).toBe(1400); // 1000*1.0 + 1000*0.4
  });
});

describe("dataConfidence", () => {
  it("is zero without sources", () => {
    expect(dataConfidence(baseInput()).value).toBe(0);
  });

  it("is between 0 and 1", () => {
    const m = dataConfidence(baseInput({
      sources: 5,
      relationships: [
        { type: "MEMBER_OF" as const, confidence: "VERIFIED" as const, startDate: null, endDate: null, amount: null },
        { type: "BOARD_MEMBER_OF" as const, confidence: "HIGH" as const, startDate: null, endDate: null, amount: null },
      ],
    }));
    expect(m.value).toBeGreaterThan(0);
    expect(m.value).toBeLessThanOrEqual(1);
  });
});

describe("computeTier", () => {
  it("returns a valid tier 1..5", () => {
    const rels = Array.from({ length: 9 }, () => ({
      type: "MEMBER_OF" as const,
      confidence: "HIGH" as const,
      startDate: null,
      endDate: null,
      amount: null,
    }));
    const tier = computeTier({ positions: [], relationships: rels, municipal: false, national: true });
    expect(tier).toBeGreaterThanOrEqual(1);
    expect(tier).toBeLessThanOrEqual(5);
  });

  it("returns tier 5 for an isolated entity", () => {
    expect(computeTier({ positions: [], relationships: [], municipal: false, national: false })).toBe(5);
  });

  it("is deterministic (not a moral judgment)", () => {
    const rels = [{ type: "BOARD_MEMBER_OF" as const, confidence: "VERIFIED" as const, startDate: null, endDate: null, amount: null }];
    const a = computeTier({ positions: [], relationships: rels, municipal: true, national: false });
    const b = computeTier({ positions: [], relationships: rels, municipal: true, national: false });
    expect(a).toBe(b);
  });
});
