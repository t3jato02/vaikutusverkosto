import { describe, it, expect } from "vitest";
import {
  detectTransitions,
  sphereOf,
  transitionDirectionLabel,
  TransitionRole,
} from "@/lib/institutionalPower/revolvingDoor";

const t = (extra: Partial<TransitionRole>): TransitionRole => ({
  roleType: "EXECUTIVE",
  organizationName: "Org",
  ...extra,
});

describe("revolving-door transition detection (section 9)", () => {
  it("detects a minister → company board transition (public to corporate)", () => {
    const transitions = detectTransitions([
      t({ roleType: "MINISTER", organizationName: "Valtioneuvosto", startDate: new Date("2019-06-06"), endDate: new Date("2023-06-20") }),
      t({ roleType: "BOARD_CHAIR", organizationName: "Yhtiö Oy", organizationEntityType: "COMPANY", startDate: new Date("2023-09-01") }),
    ]);
    expect(transitions.length).toBe(1);
    expect(transitions[0].direction).toBe("public_to_corporate");
    expect(transitions[0].from.roleType).toBe("MINISTER");
    expect(transitions[0].to.roleType).toBe("BOARD_CHAIR");
  });

  it("detects industry executive → regulator (corporate to public)", () => {
    const transitions = detectTransitions([
      t({ roleType: "EXECUTIVE", organizationEntityType: "COMPANY", startDate: new Date("2015-01-01"), endDate: new Date("2019-12-31") }),
      t({ roleType: "REGULATOR", organizationName: "Traficom", startDate: new Date("2020-01-01") }),
    ]);
    expect(transitions[0].direction).toBe("corporate_to_public");
  });

  it("computes the gap in days between roles", () => {
    const transitions = detectTransitions([
      t({ roleType: "CIVIL_SERVANT", organizationName: "VM", endDate: new Date("2020-12-31") }),
      t({ roleType: "ORGANISATION_LEADER", organizationName: "Liitto ry", startDate: new Date("2021-01-01") }),
    ]);
    expect(transitions[0].gapDays).toBe(1);
  });

  it("never treats overlapping or open-ended roles as a transition", () => {
    const transitions = detectTransitions([
      t({ roleType: "MINISTER", organizationName: "Valtioneuvosto", startDate: new Date("2019-06-06"), endDate: new Date("2023-06-20") }),
      // Board seat started WHILE the minister role was still running.
      t({ roleType: "BOARD_MEMBER", organizationName: "Säätiö", startDate: new Date("2022-01-01") }),
    ]);
    expect(transitions.length).toBe(0);
  });

  it("does not call a still-current role a transition", () => {
    const transitions = detectTransitions([
      t({ roleType: "MP", organizationName: "Eduskunta", startDate: new Date("2019-01-01") }), // no end date
      t({ roleType: "BOARD_MEMBER", organizationName: "Säätiö", startDate: new Date("2021-01-01") }),
    ]);
    expect(transitions.length).toBe(0);
  });

  it("keeps the same sphere quiet (no false transition)", () => {
    const transitions = detectTransitions([
      t({ roleType: "EXECUTIVE", organizationEntityType: "COMPANY", startDate: new Date("2019-01-01") }),
      t({ roleType: "CEO", organizationEntityType: "COMPANY", startDate: new Date("2022-01-01") }),
    ]);
    expect(transitions.length).toBe(0);
  });

  it("labels transitions neutrally in Finnish", () => {
    expect(transitionDirectionLabel("public_to_corporate")).toBe("Julkisesta tehtävästä yritystehtävään");
    expect(transitionDirectionLabel("corporate_to_public")).toBe("Yritystehtävästä julkiseen tehtävään");
    expect(transitionDirectionLabel("public_to_ngo", "en")).toBe("Public to organisation");
  });

  it("respects an explicit sphere override", () => {
    expect(sphereOf(t({ roleType: "EXECUTIVE", sphere: "public" }))).toBe("public");
  });

  it("carries the sources behind each transition", () => {
    const transitions = detectTransitions([
      t({ roleType: "MINISTER", sourceName: "Valtioneuvoston nimityspäätös", endDate: new Date("2023-06-20") }),
      t({ roleType: "BOARD_MEMBER", sourceName: "Yrityksen hallinto", startDate: new Date("2023-09-01") }),
    ]);
    expect(transitions[0].sourceNames).toEqual(["Valtioneuvoston nimityspäätös", "Yrityksen hallinto"]);
  });
});