// Benefits / gifts / awards / hospitality — shared labels and helpers (section 6).
// Public UI must never render raw enums. An ESTIMATED value is never displayed
// as an exact price; sensitivity is encoded in the review policy, not here.

import type { BenefitEventType, ValuePrecision, BenefitReviewStatus } from "@prisma/client";

type Label = { fi: string; en: string };

export const BENEFIT_EVENT_TYPE_LABELS: Record<BenefitEventType, Label> = {
  GIFT: { fi: "Lahja", en: "Gift" },
  AWARD: { fi: "Palkinto", en: "Award" },
  HONOUR: { fi: "Kunnianosoitus", en: "Honour" },
  DECORATION: { fi: "Kunniamerkki", en: "Decoration" },
  PORTRAIT: { fi: "Muotokuva", en: "Portrait" },
  TRAVEL: { fi: "Matka", en: "Travel" },
  ACCOMMODATION: { fi: "Majoitus", en: "Accommodation" },
  HOSPITALITY: { fi: "Vieraanvaraisuus", en: "Hospitality" },
  EVENT_TICKET: { fi: "Tapahtumalippu", en: "Event ticket" },
  MEAL: { fi: "Ateria", en: "Meal" },
  PRIZE: { fi: "Palkintoraha", en: "Prize" },
  SPONSORED_TRIP: { fi: "Sponsoroitu matka", en: "Sponsored trip" },
  COMMISSIONED_WORK: { fi: "Tilaustyö", en: "Commissioned work" },
  OTHER: { fi: "Muu etu", en: "Other benefit" },
};

export function benefitEventTypeLabel(t: BenefitEventType | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!t) return "";
  return BENEFIT_EVENT_TYPE_LABELS[t as BenefitEventType]?.[lang] ?? String(t);
}

export const VALUE_PRECISION_LABELS: Record<ValuePrecision, Label & { description: string }> = {
  EXACT: {
    fi: "Tarkka summa",
    en: "Exact value",
    description: "Summa on virallinen tai tilintarkastettu (esim. tilinpäätöksestä).",
  },
  REPORTED: {
    fi: "Ilmoitettu summa",
    en: "Reported value",
    description: "Summa on lähdejulkaisun ilmoittama, mutta ei tilintarkastettu.",
  },
  CALCULATED: {
    fi: "Johdettu summa",
    en: "Calculated value",
    description: "Summa on laskettu lähdeaineistosta (esim. prosenttiosuus kokonaissummasta).",
  },
  ESTIMATED: {
    fi: "Arvio",
    en: "Estimated value",
    description: "Summa on arvio. Sitä ei koskaan esitetä tarkkana hintana.",
  },
  UNKNOWN: {
    fi: "Ei ilmoitettu",
    en: "Unknown value",
    description: "Summaa ei ole dokumentoitu tai se ei ole julkinen.",
  },
};

export function valuePrecisionLabel(t: ValuePrecision | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!t) return "";
  return VALUE_PRECISION_LABELS[t as ValuePrecision]?.[lang] ?? String(t);
}

export function valuePrecisionDescription(t: ValuePrecision | string | null | undefined): string {
  if (!t) return "";
  return VALUE_PRECISION_LABELS[t as ValuePrecision]?.description ?? "";
}

export const BENEFIT_REVIEW_LABELS: Record<BenefitReviewStatus, Label> = {
  PENDING_REVIEW: { fi: "Odottaa tarkistusta", en: "Pending review" },
  PUBLISHED: { fi: "Julkaistu", en: "Published" },
  REJECTED: { fi: "Hylätty", en: "Rejected" },
  DISPUTED: { fi: "Riitautettu", en: "Disputed" },
};

export function benefitReviewLabel(t: BenefitReviewStatus | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!t) return "";
  return BENEFIT_REVIEW_LABELS[t as BenefitReviewStatus]?.[lang] ?? String(t);
}

/** The only statuses the public UI may show as documented benefit events. */
export const PUBLIC_BENEFIT_STATUSES: BenefitReviewStatus[] = ["PUBLISHED"];

/** Selection-role text used to separate award facts (section 9). */
export const AWARD_SELECTION_ROLES = {
  winner: "voittaja",
  selection: "voittajan valinta",
  jury: "tuomaristo",
} as const;

export function selectionRoleLabel(role: string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!role) return "";
  switch (role) {
    case "winner":
      return lang === "fi" ? "voittaja" : "winner";
    case "selection":
      return lang === "fi" ? "voittajan valinta" : "selection";
    case "jury":
      return lang === "fi" ? "tuomaristo" : "jury";
    default:
      return role;
  }
}

/** Human "who received from whom" summary for a benefit event row. */
export function benefitPartyLabel(
  e: { canonicalName: string } | null | undefined,
  fallback: string,
): string {
  return e ? e.canonicalName : fallback;
}