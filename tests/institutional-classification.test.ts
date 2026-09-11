import { describe, it, expect } from "vitest";
import {
  derivePersonClassifications,
  currentClassifications,
  hasDocumentedClassification,
  employmentClassification,
  ClassificationInput,
} from "@/lib/institutionalPower/classification";

describe("person classification derivation (section 2)", () => {
  it("derives MULTIPLE SIMULTANEOUS classifications from documented roles", () => {
    const input: ClassificationInput = {
      positions: [
        { roleType: "CEO", isCurrent: true },
        { roleType: "BOARD_CHAIR", isCurrent: true },
        { roleType: "BOARD_MEMBER", isCurrent: true },
      ],
    };
    const cs = derivePersonClassifications(input);
    const keys = cs.map((c) => c.key).sort();
    expect(keys).toEqual(["BOARD_CHAIR", "BOARD_MEMBER", "CEO"]);
    expect(cs.every((c) => c.temporalState === "CURRENT")).toBe(true);
  });

  it("keeps a former minister alongside a current board chair (no mutual exclusion)", () => {
    const input: ClassificationInput = {
      positions: [
        { roleType: "MINISTER", isCurrent: false },
        { roleType: "BOARD_CHAIR", isCurrent: true },
        { roleType: "TRUSTEE", isCurrent: true },
      ],
    };
    const cs = derivePersonClassifications(input);
    expect(cs.map((c) => c.key).sort()).toEqual(["BOARD_CHAIR", "MINISTER", "TRUSTEE"]);
    const minister = cs.find((c) => c.key === "MINISTER")!;
    expect(minister.temporalState).toBe("HISTORICAL");
    expect(minister.isCurrent).toBe(false);
  });

  it("derives board classifications from documented relationships", () => {
    const input: ClassificationInput = {
      positions: [],
      relationships: [
        { type: "BOARD_MEMBER_OF", isCurrent: true },
        { type: "CHAIRS", isCurrent: true },
      ],
    };
    const cs = derivePersonClassifications(input);
    expect(cs.map((c) => c.key).sort()).toEqual(["BOARD_CHAIR", "BOARD_MEMBER"]);
    expect(cs.every((c) => c.basis === "relationship")).toBe(true);
  });

  it("a historical relationship never surfaces as a current classification", () => {
    const input: ClassificationInput = {
      positions: [],
      relationships: [{ type: "BOARD_MEMBER_OF", isCurrent: false }],
    };
    expect(currentClassifications(input)).toEqual([]);
    expect(hasDocumentedClassification(input)).toBe(true); // still documented history
  });

  it("a current fact wins over a historical one with the same key", () => {
    const input: ClassificationInput = {
      positions: [
        { roleType: "BOARD_MEMBER", isCurrent: false },
        { roleType: "BOARD_MEMBER", isCurrent: true },
      ],
    };
    const cs = derivePersonClassifications(input);
    const board = cs.find((c) => c.key === "BOARD_MEMBER")!;
    expect(board.temporalState).toBe("CURRENT");
    expect(cs.length).toBe(1);
  });

  it("employment classification derives from a documented employer sector", () => {
    const c = employmentClassification(["BANKING"]);
    expect(c).not.toBeNull();
    expect(c!.key).toBe("BANKER");
    expect(c!.basis).toBe("employment");

    expect(employmentClassification(["ENERGY"])).toBeNull();
    expect(employmentClassification(null)).toBeNull();
  });
});