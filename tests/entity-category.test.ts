import { describe, it, expect } from "vitest";
import { classifyEntityCategory } from "@/lib/entityCategory";

describe("classifyEntityCategory (C5 Phase 9)", () => {
  const c = (name: string, extra: Record<string, unknown> = {}) => classifyEntityCategory({ name, ...extra });

  it("sovereign state + ministries → GOVERNMENT", () => {
    expect(c("SUOMEN TASAVALTA*REPUBLIQUE DE FINLANDE REPUBLIC OF FINLAND")).toBe("GOVERNMENT");
    expect(c("Opetus- ja kulttuuriministeriö")).toBe("GOVERNMENT");
  });

  it("universities (incl. Oy / säätiö / akademi forms) → UNIVERSITY", () => {
    expect(c("HELSINGIN YLIOPISTO*UNIVERSITY OF HELSINKI")).toBe("UNIVERSITY");
    expect(c("TAMPEREEN KORKEAKOULUSAATIO SR*TAMPERE UNIVERSITY")).toBe("UNIVERSITY");
    expect(c("Åbo Akademi")).toBe("UNIVERSITY");
    expect(c("TURUN AMMATTIKORKEAKOULU OY*TURKU UNIVERSITY OF APPLIED SCIENCES")).toBe("UNIVERSITY");
  });

  it("state agencies + research institutes + municipalities → GOVERNMENT_AGENCY", () => {
    expect(c("TERVEYDEN JA HYVINVOINNIN LAITOS*FINNISH INSTITUTE FOR HEALTH AND WELFARE")).toBe("GOVERNMENT_AGENCY");
    expect(c("METSAHALLITUS*LUONTOPALVELUT PARKS& WILDLIFE FINLAND")).toBe("GOVERNMENT_AGENCY");
    expect(c("TULLI*NATIONAL BOARD OF CUSTOMS")).toBe("GOVERNMENT_AGENCY");
    expect(c("HELSINGIN KAUPUNKI*HELSINGFORS STAD CITY OF HELSINKI")).toBe("GOVERNMENT_AGENCY");
    expect(c("Päijät-Hämeen liitto, maakunta")).toBe("GOVERNMENT_AGENCY");
  });

  it("EU / international bodies → INTERNATIONAL_ORGANIZATION", () => {
    expect(c("EUROPEAN CHEMICALS AGENCY*ECHA", { jurisdiction: "EU" })).toBe("INTERNATIONAL_ORGANIZATION");
    expect(c("NORDIC ENVIRONMENT FINANCE CORPORATION")).toBe("INTERNATIONAL_ORGANIZATION");
  });

  it("foundations vs associations: 'sr' → FOUNDATION, 'ry'/'rf'/'rs' → NGO", () => {
    expect(c("John Nurmisen Säätiö sr")).toBe("FOUNDATION");
    expect(c("Työtehoseura ry")).toBe("NGO");
    expect(c("SUOMEN RAUHANPUOLUSTAJAT RY FREDSKAMPARNA I FINLAND RF SUOMA RAFIBEALUSTEADDJIT RS")).toBe("NGO");
  });

  it("companies by legal form → COMPANY", () => {
    expect(c("Atria Oyj")).toBe("COMPANY");
    expect(c("Microsoft Corporation")).toBe("COMPANY");
    expect(c("Rauma Marine Constructions Oy")).toBe("COMPANY");
  });

  it("returns null when nothing fires unambiguously (never guesses)", () => {
    expect(c("EURO-BIOIMAGING")).toBeNull();
    expect(c("Some Ambiguous Name")).toBeNull();
  });
});
