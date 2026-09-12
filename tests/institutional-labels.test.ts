import { describe, it, expect } from "vitest";
import {
  ROLE_TYPE_LABELS,
  SECTOR_LABELS,
  CRITICAL_FUNCTION_LABELS,
  PROCUREMENT_PROCEDURE_LABELS,
  OWNERSHIP_CALCULATION_STATUS_LABELS,
  INSTITUTIONAL_CATEGORY_LABELS,
  roleTypeLabel,
  sectorLabel,
  criticalFunctionLabel,
  procurementProcedureLabel,
  institutionalCategoryLabel,
} from "@/lib/constants";
import {
  RoleType,
  Sector,
  CriticalFunction,
  ProcurementProcedure,
  OwnershipCalculationStatus,
  InstitutionalCategory,
} from "@prisma/client";

describe("institutional-power label coverage invariants (foundation)", () => {
  it("every role type has a Finnish label", () => {
    for (const v of Object.values(RoleType)) {
      expect(ROLE_TYPE_LABELS[v]?.fi).toBeTruthy();
    }
  });

  it("every sector has a Finnish label", () => {
    for (const v of Object.values(Sector)) {
      expect(SECTOR_LABELS[v]?.fi).toBeTruthy();
    }
  });

  it("every critical function has a Finnish label", () => {
    for (const v of Object.values(CriticalFunction)) {
      expect(CRITICAL_FUNCTION_LABELS[v]?.fi).toBeTruthy();
    }
  });

  it("every procurement procedure has a Finnish label", () => {
    for (const v of Object.values(ProcurementProcedure)) {
      expect(PROCUREMENT_PROCEDURE_LABELS[v]?.fi).toBeTruthy();
    }
  });

  it("every ownership calculation status has a Finnish label", () => {
    for (const v of Object.values(OwnershipCalculationStatus)) {
      expect(OWNERSHIP_CALCULATION_STATUS_LABELS[v]?.fi).toBeTruthy();
    }
  });

  it("every institutional category has a Finnish label (public-institutions stream)", () => {
    for (const v of Object.values(InstitutionalCategory)) {
      expect(INSTITUTIONAL_CATEGORY_LABELS[v]?.fi).toBeTruthy();
      expect(INSTITUTIONAL_CATEGORY_LABELS[v]?.en).toBeTruthy();
    }
  });
});

describe("institutional-power label accessors", () => {
  it("returns labels and falls back gracefully", () => {
    expect(roleTypeLabel("CEO", "fi")).toBe("Toimitusjohtaja");
    expect(sectorLabel("ELECTRICITY_TRANSMISSION", "fi")).toBe("Sähkönsiirto");
    expect(criticalFunctionLabel("NATIONAL_GRID", "en")).toBe("National grid");
    expect(procurementProcedureLabel("DIRECT_AWARD", "fi")).toBe("Suorahankinta");
    expect(institutionalCategoryLabel("MINISTRY", "fi")).toBe("Ministeriö");
    expect(institutionalCategoryLabel("MUNICIPALITY", "en")).toBe("Municipality");
    expect(institutionalCategoryLabel("NOT_A_CATEGORY", "fi")).toBe("not_a_category");
    expect(roleTypeLabel("NOT_A_ROLE", "fi")).toBe("not_a_role");
  });
});