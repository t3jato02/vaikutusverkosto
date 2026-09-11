// Public media finance — financial statement helpers (section 3, 23, 43).
// Statement line items are category totals from official financial statements.
// The category label comes from the source document; we provide the stable
// machine keys and the Finnish/English display labels used across the UI.

import type { StatementKind } from "@prisma/client";
import { valuePrecisionLabel, valuePrecisionDescription } from "./benefits";

export interface StatementCategory {
  key: string;
  fi: string;
  en: string;
  /** Parent category keys this category may roll into (prevents double counting). */
  parent?: string;
}

// Stable keys mirror the categories Yle (and other public media) report in
// their financial statements. Other organisations may use any string key;
// unknown keys fall back to the stored categoryLabel.
export const STATEMENT_CATEGORIES: Record<string, StatementCategory> = {
  // Income
  YLE_APPROPRIATION: { key: "YLE_APPROPRIATION", fi: "Valtion rahoitus (Yle-vero)", en: "State appropriation (Yle tax)" },
  PROGRAMME_INCOME: { key: "PROGRAMME_INCOME", fi: "Ohjelmatoiminnan tuotot", en: "Programme revenue" },
  SERVICE_INCOME: { key: "SERVICE_INCOME", fi: "Palvelumyynti", en: "Service sales" },
  RENTAL_INCOME: { key: "RENTAL_INCOME", fi: "Vuokratuotot", en: "Rental income" },
  OTHER_INCOME: { key: "OTHER_INCOME", fi: "Muut tuotot", en: "Other income" },
  TOTAL_INCOME: { key: "TOTAL_INCOME", fi: "Tuotot yhteensä", en: "Total income" },
  // Expenditure
  PERSONNEL_COSTS: { key: "PERSONNEL_COSTS", fi: "Henkilöstökulut", en: "Personnel costs" },
  PERSONNEL_WAGES: { key: "PERSONNEL_WAGES", fi: "Palkat", en: "Wages", parent: "PERSONNEL_COSTS" },
  PERSONNEL_FEES: { key: "PERSONNEL_FEES", fi: "Palkkiot", en: "Fees", parent: "PERSONNEL_COSTS" },
  PERSONNEL_PENSIONS: { key: "PERSONNEL_PENSIONS", fi: "Eläkekulut", en: "Pension expenses", parent: "PERSONNEL_COSTS" },
  PERSONNEL_OTHER: { key: "PERSONNEL_OTHER", fi: "Muut henkilöstösivukulut", en: "Other personnel side costs", parent: "PERSONNEL_COSTS" },
  RIGHTS_COSTS: { key: "RIGHTS_COSTS", fi: "Lähetysoikeudet", en: "Broadcasting rights", parent: "CONTENT_COSTS" },
  RIGHTS_DOMESTIC: { key: "RIGHTS_DOMESTIC", fi: "Kotimaiset oikeudet", en: "Domestic rights", parent: "RIGHTS_COSTS" },
  RIGHTS_FOREIGN: { key: "RIGHTS_FOREIGN", fi: "Ulkomaiset ja urheiluoikeudet", en: "Foreign and sports rights", parent: "RIGHTS_COSTS" },
  PROGRAMME_COSTS: { key: "PROGRAMME_COSTS", fi: "Ohjelmatoiminnan kulut", en: "Programme operations", parent: "CONTENT_COSTS" },
  MUSIC_FEES: { key: "MUSIC_FEES", fi: "Musiikin esityskorvaukset", en: "Music performance fees", parent: "PROGRAMME_COSTS" },
  CONTENT_COSTS: { key: "CONTENT_COSTS", fi: "Sisältö- ja ohjelmakulut", en: "Content and programme costs" },
  DEPRECIATION: { key: "DEPRECIATION", fi: "Poistot", en: "Depreciation and amortisation" },
  DISTRIBUTION_COSTS: { key: "DISTRIBUTION_COSTS", fi: "Jakelukulut", en: "Distribution costs" },
  TECHNOLOGY_COSTS: { key: "TECHNOLOGY_COSTS", fi: "Teknologiakulut", en: "Technology costs" },
  PROPERTY_COSTS: { key: "PROPERTY_COSTS", fi: "Vuokrat ja kiinteistökulut", en: "Rents and property costs" },
  OTHER_EXPENSES: { key: "OTHER_EXPENSES", fi: "Muut kulut", en: "Other expenses" },
  TOTAL_EXPENSES: { key: "TOTAL_EXPENSES", fi: "Kulut yhteensä", en: "Total expenses" },
  // Aggregate facts
  FREELANCER_FEES: { key: "FREELANCER_FEES", fi: "Freelancerpalkkiot", en: "Freelancer fees" },
  CONTENT_PURCHASES: { key: "CONTENT_PURCHASES", fi: "Sisältö- ja ohjelmapalveluhankinnat", en: "Content and programme purchases" },
  TAX_FOOTPRINT: { key: "TAX_FOOTPRINT", fi: "Verokertymävaikutus", en: "Tax footprint" },
};

export function statementCategoryLabel(category: string, storedLabel: string, lang: "fi" | "en" = "fi"): string {
  const known = STATEMENT_CATEGORIES[category];
  if (known) return lang === "fi" ? known.fi : known.en;
  return storedLabel || category;
}

export function statementCategoryFi(key: string): string {
  return STATEMENT_CATEGORIES[key]?.fi ?? key;
}

export function statementCategoryEn(key: string): string {
  return STATEMENT_CATEGORIES[key]?.en ?? key;
}

export const STATEMENT_KIND_LABELS: Record<StatementKind, { fi: string; en: string }> = {
  INCOME: { fi: "Tuotot", en: "Income" },
  EXPENDITURE: { fi: "Kulut", en: "Expenditure" },
};

export function statementKindLabel(kind: StatementKind | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!kind) return "";
  return STATEMENT_KIND_LABELS[kind as StatementKind]?.[lang] ?? String(kind);
}

export { valuePrecisionLabel, valuePrecisionDescription };

/**
 * Sum an organisation's statement items without double counting.
 * Rows flagged `isTotal` are grand totals and are never summed together with
 * category rows. When no grand-total row exists, child categories that roll
 * into a parent present in the same set are dropped (the parent total already
 * includes them) — a total never sums the same funding through both parent
 * and child categories (section 43).
 */
export function sumStatementItems<T extends { kind: string; amount: number; isTotal: boolean; category: string }>(
  items: T[],
  kind: StatementKind,
): { categories: T[]; total: number | null } {
  const rows = items.filter((i) => i.kind === kind);
  const totals = rows.filter((i) => i.isTotal);
  const categories = rows.filter((i) => !i.isTotal);

  // If any grand-total row exists, prefer it (audited total).
  if (totals.length > 0) {
    const sum = totals.reduce((acc, t) => acc + Number(t.amount), 0);
    return { categories, total: sum };
  }

  // Otherwise drop children whose parent is also present, then sum the rest.
  const present = new Set(categories.map((c) => c.category));
  const nonDoubleCounted = categories.filter((c) => {
    const meta = STATEMENT_CATEGORIES[c.category];
    if (meta?.parent && present.has(meta.parent)) return false;
    return true;
  });
  const total = nonDoubleCounted.reduce((acc, t) => acc + Number(t.amount), 0);
  return { categories, total };
}

/** Sort a category breakdown largest-first for display. */
export function sortByAmount<T extends { amount: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.amount) - Number(a.amount));
}