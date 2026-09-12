import { describe, it, expect } from "vitest";
import { detectTransitions, sphereOf, type TransitionRole } from "@/lib/institutionalPower/revolvingDoor";

const T = (o: Partial<TransitionRole> & { start?: string; end?: string }): TransitionRole => ({
  roleType: o.roleType ?? null,
  role: o.role ?? null,
  organizationName: o.organizationName ?? null,
  organizationEntityType: o.organizationEntityType ?? null,
  startDate: o.start ? new Date(o.start) : null,
  endDate: o.end ? new Date(o.end) : null,
  sourceName: o.sourceName ?? null,
  sourceUrl: o.sourceUrl ?? null,
});

describe("public-institutions revolving-door detection (stream C)", () => {
  it("detects a valid public → corporate transition with neutral direction label", () => {
    const transitions = detectTransitions([
      T({ roleType: "CIVIL_SERVANT", organizationEntityType: "PUBLIC_AUTHORITY", role: "Osastopäällikkö", start: "2015-01-01", end: "2020-12-31" }),
      T({ roleType: "CEO", organizationEntityType: "COMPANY", role: "Toimitusjohtaja", start: "2021-01-01" }),
    ]);
    expect(transitions.length).toBe(1);
    expect(transitions[0].direction).toBe("public_to_corporate");
    expect(transitions[0].gapDays).toBe(1);
  });

  it("does NOT generate a transition when the FROM role has no end date (still current)", () => {
    const transitions = detectTransitions([
      T({ roleType: "MINISTER", organizationEntityType: "GOVERNMENT_BODY", start: "2023-06-20" }),
      T({ roleType: "BOARD_CHAIR", organizationEntityType: "COMPANY", start: "2024-01-01" }),
    ]);
    // The minister role is open-ended → simultaneous roles, not a transition.
    expect(transitions.length).toBe(0);
  });

  it("does NOT generate a transition when roles overlap in time", () => {
    const transitions = detectTransitions([
      T({ roleType: "DIRECTOR_GENERAL", organizationEntityType: "PUBLIC_AUTHORITY", start: "2018-01-01", end: "2023-12-31" }),
      T({ roleType: "BOARD_MEMBER", organizationEntityType: "COMPANY", start: "2022-01-01" }),
    ]);
    expect(transitions.length).toBe(0);
  });

  it("detects an NGO leader → public role transition", () => {
    const transitions = detectTransitions([
      T({ roleType: "NGO_LEADER", organizationEntityType: "ASSOCIATION", start: "2016-01-01", end: "2019-12-31" }),
      T({ roleType: "MUNICIPAL_POLITICIAN", organizationEntityType: "GOVERNMENT_BODY", start: "2020-01-01" }),
    ]);
    expect(transitions.length).toBe(1);
    expect(transitions[0].direction).toBe("ngo_to_public");
  });

  it("spheres public institutions as public, unions/associations as ngo", () => {
    expect(sphereOf(T({ roleType: "DIRECTOR_GENERAL", organizationEntityType: "PUBLIC_AUTHORITY" }))).toBe("public");
    expect(sphereOf(T({ roleType: "MINISTER", organizationEntityType: "GOVERNMENT_BODY" }))).toBe("public");
    expect(sphereOf(T({ roleType: "UNION_LEADER", organizationEntityType: "UNION" }))).toBe("ngo");
    expect(sphereOf(T({ roleType: "FOUNDATION_EXECUTIVE", organizationEntityType: "FOUNDATION" }))).toBe("ngo");
  });
});