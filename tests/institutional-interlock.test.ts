import { describe, it, expect } from "vitest";
import {
  boardInterlocks,
  mostConnectedBoardMembers,
  crossSectorInterlocks,
  publicPrivateBoardOverlap,
  isBoardRole,
  InterlockRole,
} from "@/lib/institutionalPower/interlock";

const role = (person: string, org: string, extra: Partial<InterlockRole>): InterlockRole => ({
  personEntityId: person,
  organizationEntityId: org,
  organizationName: org,
  isCurrent: true,
  ...extra,
});

describe("board interlock engine (section 8)", () => {
  it("detects a person with board roles across multiple companies", () => {
    const roles = [
      role("p1", "CompanyA", { roleType: "BOARD_MEMBER", organizationSectors: ["TECHNOLOGY"] }),
      role("p1", "CompanyB", { roleType: "BOARD_MEMBER", organizationSectors: ["BANKING"] }),
      role("p2", "CompanyA", { roleType: "BOARD_MEMBER", organizationSectors: ["TECHNOLOGY"] }),
    ];
    const results = boardInterlocks(roles);
    const p1 = results.find((r) => r.personEntityId === "p1")!;
    expect(p1.currentBoardCount).toBe(2);
    expect(p1.crossSector).toBe(true);
    expect(p1.publicPrivateOverlap).toBe(false);
    const p2 = results.find((r) => r.personEntityId === "p2")!;
    expect(p2.currentBoardCount).toBe(1);
  });

  it("ranks people by number of current board roles", () => {
    const roles = [
      role("p1", "A", { roleType: "BOARD_MEMBER" }),
      role("p1", "B", { roleType: "BOARD_MEMBER" }),
      role("p1", "C", { roleType: "BOARD_MEMBER" }),
      role("p2", "D", { roleType: "BOARD_CHAIR" }),
    ];
    const top = mostConnectedBoardMembers(roles, 5);
    expect(top[0].personEntityId).toBe("p1");
    expect(top[0].currentBoardCount).toBe(3);
  });

  it("keeps historical roles historical — they never count as current interlocks", () => {
    const roles = [
      role("p1", "A", { roleType: "BOARD_MEMBER", isCurrent: true, organizationSectors: ["TELECOM"] }),
      role("p1", "B", { roleType: "BOARD_MEMBER", isCurrent: false, organizationSectors: ["BANKING"] }),
    ];
    const [r] = boardInterlocks(roles);
    expect(r.currentBoardCount).toBe(1);
    expect(r.historicalBoardCount).toBe(1);
    expect(r.crossSector).toBe(false); // only current roles count
  });

  it("detects public/private board overlap", () => {
    const roles = [
      role("p1", "ValtioYhtiö", { roleType: "BOARD_MEMBER", organizationIsPublic: true, organizationSectors: ["ENERGY"] }),
      role("p1", "Private Oy", { roleType: "BOARD_MEMBER", organizationIsPublic: false, organizationSectors: ["FOOD"] }),
    ];
    const [r] = boardInterlocks(roles);
    expect(r.publicPrivateOverlap).toBe(true);
    expect(r.publicBoardCount).toBe(1);
    expect(r.privateBoardCount).toBe(1);
    expect(publicPrivateBoardOverlap(roles).map((x) => x.personEntityId)).toEqual(["p1"]);
  });

  it("cross-sector query returns only multi-sector people", () => {
    const roles = [
      role("p1", "A", { roleType: "BOARD_MEMBER", organizationSectors: ["RAIL"] }),
      role("p1", "B", { roleType: "BOARD_MEMBER", organizationSectors: ["AVIATION"] }),
      role("p2", "C", { roleType: "BOARD_MEMBER", organizationSectors: ["RAIL"] }),
    ];
    const cs = crossSectorInterlocks(roles);
    expect(cs.map((r) => r.personEntityId)).toEqual(["p1"]);
  });

  it("recognises board role types and ignores non-board roles", () => {
    expect(isBoardRole("BOARD_MEMBER")).toBe(true);
    expect(isBoardRole("BOARD_CHAIR")).toBe(true);
    expect(isBoardRole("CHAIRS")).toBe(true);
    expect(isBoardRole("CEO")).toBe(false);
    expect(isBoardRole(null)).toBe(false);
    const [r] = boardInterlocks([
      role("p1", "A", { roleType: "CEO" }), // not a board role → no interlock row
      role("p1", "B", { roleType: "BOARD_MEMBER" }),
    ]);
    expect(r.currentBoardCount).toBe(1);
  });
});