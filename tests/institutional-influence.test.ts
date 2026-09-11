import { describe, it, expect } from "vitest";
import { institutionalInfluence, InfluenceInput } from "@/lib/metrics";

function minimal(overrides: Partial<InfluenceInput> = {}): InfluenceInput {
  return {
    roles: [],
    ownershipStakes: [],
    appointmentAuthorityCount: 0,
    evidenceSources: 0,
    ...overrides,
  };
}

describe("institutional influence metric (section 7)", () => {
  it("returns NO score when evidence coverage is insufficient", () => {
    const r = institutionalInfluence(minimal({ evidenceSources: 0 }));
    expect(r.coverageSufficient).toBe(false);
    expect(r.value).toBeNull();
    expect(r.coverageNote).toBe("Ei riittävästi dataa pisteytykseen.");
  });

  it("still reports no score with sources but no documented roles", () => {
    const r = institutionalInfluence(minimal({ evidenceSources: 5 }));
    expect(r.coverageSufficient).toBe(false);
    expect(r.value).toBeNull();
  });

  it("is decomposable: every point maps to a component with a human basis", () => {
    const r = institutionalInfluence(
      minimal({
        evidenceSources: 3,
        roles: [
          { roleType: "CEO", isCurrent: true, organizationName: "Fingrid", organizationSectors: ["ELECTRICITY_TRANSMISSION"], organizationIsPublic: false, organizationEmployeeCount: 400 },
          { roleType: "BOARD_MEMBER", isCurrent: true, organizationName: "Yritys B", organizationSectors: ["TECHNOLOGY"] },
        ],
      }),
    );
    expect(r.coverageSufficient).toBe(true);
    expect(r.value).not.toBeNull();
    expect(r.components.length).toBeGreaterThanOrEqual(3);
    const roleAuth = r.components.find((c) => c.key === "role_authority")!;
    expect(roleAuth.points).toBe(24 + 8); // CEO + board member
    expect(roleAuth.basis).toContain("Fingrid");
    const sectors = r.components.find((c) => c.key === "cross_sector_reach")!;
    expect(sectors.points).toBe(4); // 2 sectors × 2
  });

  it("caps the total at 100 and never exceeds it", () => {
    const roles: InfluenceInput["roles"] = [
      { roleType: "CEO", isCurrent: true, organizationIsPublic: false, organizationSectors: ["ENERGY"] },
      { roleType: "BOARD_CHAIR", isCurrent: true, organizationIsPublic: true, organizationSectors: ["BANKING"] },
      { roleType: "BOARD_MEMBER", isCurrent: true, organizationIsPublic: true, organizationSectors: ["TELECOM"] },
      { roleType: "DIRECTOR_GENERAL", isCurrent: true, organizationIsPublic: true, organizationSectors: ["GAS"] },
      { roleType: "REGULATOR", isCurrent: true, organizationIsPublic: true, organizationSectors: ["RAIL"] },
      { roleType: "MP", isCurrent: true, organizationIsPublic: true, organizationSectors: ["MEDIA"] },
    ];
    const r = institutionalInfluence(minimal({ evidenceSources: 9, roles }));
    expect(r.value).not.toBeNull();
    expect(r.value).toBeLessThanOrEqual(100);
    const sum = r.components.reduce((s, c) => s + c.points, 0);
    expect(sum).toBeLessThanOrEqual(100);
  });

  it("is NOT an ideology score: no political-sentiment or person attributes", () => {
    const r = institutionalInfluence(
      minimal({
        evidenceSources: 2,
        roles: [{ roleType: "MP", isCurrent: true, organizationSectors: ["MEDIA"] }],
      }),
    );
    const json = JSON.stringify(r);
    expect(json.toLowerCase()).not.toContain("ideolog");
    expect(json.toLowerCase()).not.toContain("party");
    expect(r.interpretation).toContain("Ei arvostelma vallan käytöstä");
  });

  it("counts only REPORTED/CALCULATED direct ownership stakes", () => {
    const r = institutionalInfluence(
      minimal({
        evidenceSources: 2,
        roles: [{ roleType: "INVESTOR", isCurrent: true, organizationSectors: ["INVESTMENT"] }],
        ownershipStakes: [
          { percentage: 100, isIndirect: false, calculationStatus: "REPORTED" },
          { percentage: 100, isIndirect: false, calculationStatus: "UNKNOWN" }, // excluded
          { percentage: 100, isIndirect: true, calculationStatus: "REPORTED" }, // indirect excluded
        ],
      }),
    );
    const ownership = r.components.find((c) => c.key === "ownership_control")!;
    expect(ownership.points).toBe(10); // one 100% direct reported stake → 10 (capped)
  });

  it("a historical role contributes no role-authority points", () => {
    const r1 = institutionalInfluence(
      minimal({
        evidenceSources: 1,
        roles: [{ roleType: "CEO", isCurrent: false, organizationSectors: ["ENERGY"] }],
      }),
    );
    // coverage requires a CURRENT role — historical-only is insufficient.
    expect(r1.coverageSufficient).toBe(false);
  });
});