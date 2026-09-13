import { describe, it, expect } from "vitest";
import {
  bankBoardAndListedCompanyInterlocks,
  pensionBoardAndStateCompanyInterlocks,
  formerPoliticianFinanceRoles,
  publicOfficialSupervisoryRoles,
  type LoadedRole,
} from "@/lib/institutionalPower/financeInterlocks";

function role(over: Partial<LoadedRole>): LoadedRole {
  return {
    personEntityId: "p1",
    personName: "Testi Henkilö",
    role: "Hallituksen jäsen",
    roleType: "BOARD_MEMBER",
    isCurrent: true,
    organizationEntityId: "o1",
    organizationName: "Testi Org",
    organizationType: "COMPANY",
    organizationCategory: null,
    financeTypes: [],
    nasdaqSymbols: [],
    sourceUrl: "https://example.fi/role-source",
    sourceName: "Testi lähde",
    ...over,
  };
}

describe("finance board interlock queries", () => {
  it("bank board + listed-company board", () => {
    const rows: LoadedRole[] = [
      role({ personEntityId: "a", personName: "A", organizationName: "Pankki", financeTypes: ["BANK"] }),
      role({ personEntityId: "a", personName: "A", organizationName: "Listayhtiö", nasdaqSymbols: ["KONE"] }),
      // bank board but no listed board
      role({ personEntityId: "b", personName: "B", organizationName: "Pankki", financeTypes: ["SAVINGS_BANK"] }),
      // listed board but not a bank board (executive role)
      role({ personEntityId: "c", personName: "C", organizationName: "Pankki", financeTypes: ["BANK"], roleType: "CEO" }),
      role({ personEntityId: "c", personName: "C", organizationName: "Listayhtiö", nasdaqSymbols: ["NOKIA"] }),
    ];
    const result = bankBoardAndListedCompanyInterlocks(rows);
    expect(result.map((r) => r.personName)).toEqual(["A"]);
    expect(result[0].sources).toContain("https://example.fi/role-source");
  });

  it("pension board + state-company board", () => {
    const rows: LoadedRole[] = [
      role({ personEntityId: "a", personName: "A", organizationName: "Varma", financeTypes: ["PENSION_INSURER"] }),
      role({ personEntityId: "a", personName: "A", organizationName: "Solidium", organizationCategory: "STATE_OWNED_COMPANY" }),
      role({ personEntityId: "b", personName: "B", organizationName: "Ilmarinen", financeTypes: ["PENSION_INSURER"] }),
      role({ personEntityId: "b", personName: "B", organizationName: "Tavallinen Oy", organizationCategory: "COMPANY" }),
    ];
    const result = pensionBoardAndStateCompanyInterlocks(rows);
    expect(result.map((r) => r.personName)).toEqual(["A"]);
  });

  it("former politician + current finance role", () => {
    const rows: LoadedRole[] = [
      // historical MP role (politician) + current finance role
      role({ personEntityId: "a", personName: "A", organizationName: "Eduskunta", organizationType: "GOVERNMENT_BODY", role: "Kansanedustaja", roleType: "MP", isCurrent: false }),
      role({ personEntityId: "a", personName: "A", organizationName: "Pankki", financeTypes: ["BANK"] }),
      // current politician + finance role must NOT match (not former)
      role({ personEntityId: "b", personName: "B", organizationName: "Eduskunta", organizationType: "GOVERNMENT_BODY", role: "Kansanedustaja", roleType: "MP", isCurrent: true }),
      role({ personEntityId: "b", personName: "B", organizationName: "Pankki", financeTypes: ["BANK"] }),
    ];
    const result = formerPoliticianFinanceRoles(rows);
    expect(result.map((r) => r.personName)).toEqual(["A"]);
  });

  it("public official + supervisory role in a finance institution", () => {
    const rows: LoadedRole[] = [
      role({ personEntityId: "a", personName: "A", organizationName: "Ministeriö", organizationType: "GOVERNMENT_BODY", role: "Osastopäällikkö", roleType: "CIVIL_SERVANT" }),
      role({ personEntityId: "a", personName: "A", organizationName: "Keva", financeTypes: ["PUBLIC_PENSION_INSTITUTION"], roleType: "BOARD_MEMBER" }),
      // public official but only a CEO role in finance (not supervisory board role)
      role({ personEntityId: "b", personName: "B", organizationName: "Virasto", organizationType: "PUBLIC_AUTHORITY" }),
      role({ personEntityId: "b", personName: "B", organizationName: "Pankki", financeTypes: ["BANK"], roleType: "CEO" }),
    ];
    const result = publicOfficialSupervisoryRoles(rows);
    expect(result.map((r) => r.personName)).toEqual(["A"]);
  });

  it("every result row carries the underlying role sources", () => {
    const rows: LoadedRole[] = [
      role({ personEntityId: "a", personName: "A", organizationName: "Pankki", financeTypes: ["BANK"], sourceUrl: "https://example.fi/bank" }),
      role({ personEntityId: "a", personName: "A", organizationName: "Listayhtiö", nasdaqSymbols: ["VALMET"], sourceUrl: "https://example.fi/listed" }),
    ];
    const result = bankBoardAndListedCompanyInterlocks(rows);
    expect(result[0].sources).toContain("https://example.fi/bank");
    expect(result[0].sources).toContain("https://example.fi/listed");
  });
});