import { describe, it, expect } from "vitest";
import {
  FINANCE_INSTITUTION_TYPE_LABELS,
  SCALE_METRIC_TYPE_LABELS,
  financeInstitutionTypeLabel,
  scaleMetricTypeLabel,
} from "@/lib/constants";
import { FinanceInstitutionType, ScaleMetricType } from "@prisma/client";

describe("finance stream label coverage invariants", () => {
  it("every finance institution type has a Finnish label", () => {
    for (const v of Object.values(FinanceInstitutionType)) {
      expect(FINANCE_INSTITUTION_TYPE_LABELS[v]?.fi, v).toBeTruthy();
    }
  });

  it("every scale metric type has a Finnish label", () => {
    for (const v of Object.values(ScaleMetricType)) {
      expect(SCALE_METRIC_TYPE_LABELS[v]?.fi, v).toBeTruthy();
    }
  });

  it("label accessors return labels and fall back gracefully", () => {
    expect(financeInstitutionTypeLabel("PENSION_INSURER", "fi")).toBe("Työeläkevakuutusyhtiö");
    expect(financeInstitutionTypeLabel("CENTRAL_BANK", "en")).toBe("Central bank");
    expect(scaleMetricTypeLabel("ASSETS_UNDER_MANAGEMENT", "fi")).toBe("Hallinnoitavat varat");
    expect(financeInstitutionTypeLabel("NOT_A_TYPE", "fi")).toBe("not_a_type");
  });
});