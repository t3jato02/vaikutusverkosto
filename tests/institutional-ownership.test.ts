import { describe, it, expect } from "vitest";
import {
  percentageInBounds,
  effectiveOwnershipPercent,
  expandOwnershipChain,
  directOwnershipStake,
  isOwnershipType,
  OwnershipEdge,
} from "@/lib/institutionalPower/ownership";

const d = (s: string, t: string, p?: number | null, extra?: Partial<OwnershipEdge>): OwnershipEdge => ({
  sourceEntityId: s,
  targetEntityId: t,
  percentage: p,
  ...extra,
});

describe("ownership graph (section 4)", () => {
  it("rejects out-of-bounds percentages", () => {
    expect(percentageInBounds(0)).toBe(true);
    expect(percentageInBounds(100)).toBe(true);
    expect(percentageInBounds(50.5)).toBe(true);
    expect(percentageInBounds(-1)).toBe(false);
    expect(percentageInBounds(101)).toBe(false);
    expect(percentageInBounds(null)).toBe(true); // unknown is allowed, not invalid
  });

  it("computes effective percentage along a documented chain (product rule)", () => {
    expect(effectiveOwnershipPercent([100])).toBe(100);
    expect(effectiveOwnershipPercent([100, 100])).toBe(100);
    expect(effectiveOwnershipPercent([50, 50])).toBe(25);
    expect(effectiveOwnershipPercent([60, 30])).toBe(18);
    expect(effectiveOwnershipPercent([100, 60, 50])).toBe(30);
  });

  it("never computes a chain percentage when any hop is undocumented", () => {
    expect(effectiveOwnershipPercent([50, null])).toBeNull();
    expect(effectiveOwnershipPercent([null])).toBeNull();
    expect(effectiveOwnershipPercent([])).toBeNull();
  });

  it("expands a state → company → subsidiary chain as indirect", () => {
    const edges = [
      d("state", "patria", 100, { current: true }),
      d("patria", "sub", 60, { current: true }),
    ];
    const paths = expandOwnershipChain(edges, "state");
    expect(paths.length).toBe(2);
    const indirect = paths.find((p) => p.path.length === 3)!;
    expect(indirect.indirect).toBe(true);
    expect(indirect.effectivePercentage).toBe(60);
    expect(indirect.path).toEqual(["state", "patria", "sub"]);
    const direct = paths.find((p) => p.path.length === 2)!;
    expect(direct.indirect).toBe(false);
    expect(direct.effectivePercentage).toBe(100);
  });

  it("never traverses historical edges for a current control figure", () => {
    const edges = [
      d("state", "patria", 100, { current: true }),
      d("patria", "old", 51, { current: false }), // historical subsidiary
    ];
    const paths = expandOwnershipChain(edges, "state");
    expect(paths.map((p) => p.path.join(">"))).toEqual(["state>patria"]);
  });

  it("cuts cycles", () => {
    const edges = [
      d("a", "b", 100, { current: true }),
      d("b", "a", 20, { current: true }),
    ];
    const paths = expandOwnershipChain(edges, "a");
    expect(paths.length).toBe(1);
    expect(paths[0].path).toEqual(["a", "b"]);
  });

  it("reads a direct documented stake without synthesis", () => {
    const edges = [
      d("state", "solidium", 100, { current: true }),
      d("state", "patria", 100, { current: false }),
    ];
    expect(directOwnershipStake(edges, "state", "solidium")?.percentage).toBe(100);
    expect(directOwnershipStake(edges, "state", "patria")).toBeNull(); // historical
    expect(directOwnershipStake(edges, "state", "nope")).toBeNull();
  });

  it("recognises only the OWNS-family relationship types", () => {
    expect(isOwnershipType("OWNS")).toBe(true);
    expect(isOwnershipType("SHAREHOLDER_OF")).toBe(true);
    expect(isOwnershipType("BENEFICIAL_OWNER_OF")).toBe(true);
    expect(isOwnershipType("OWNS_MEDIA")).toBe(true);
    expect(isOwnershipType("BOARD_MEMBER_OF")).toBe(false);
    expect(isOwnershipType(null)).toBe(false);
  });
});