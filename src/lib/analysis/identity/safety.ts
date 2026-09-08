// Identity-framing safety layer (luvut 7, 14). Absolute guardrails.
//
// These functions encode rules that must NEVER be violated:
//   1. No birth country / origin from a name.
//   2. No ethnicity from a photo, no citizenship from appearance.
//   3. No religion from a name, no immigrant background from skin colour.
//   4. No national identity from a language.
//   5. No parents' origin without a source.
//   6. Missing value => "Ei vahvistettua tietoa." — an AI guess fills nothing.
//   7. Media wording is not evidence of sentiment/political favouritism.
//
// All fact-writing paths call these guards; tests enforce them.

import type { Confidence } from "@prisma/client";

/** Forum / social-platform URLs never confirm sensitive biographic facts alone. */
const UNRELIABLE_HOSTS = [
  /reddit\.com/i, /twitter\.com/i, /x\.com/i, /t\.co/i, /facebook\.com/i,
  /instagram\.com/i, /tiktok\.com/i, /youtube\.com/i,
];

export function isExplicitSourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Shared checks for any sensitive biographic fact. Returns violations (fi). */
export function checkSensitiveFact(input: { sourceUrl: string; sourceName: string; sourceType: string; confidence: Confidence }): string[] {
  const errors: string[] = [];
  if (!isExplicitSourceUrl(input.sourceUrl)) {
    errors.push("Sensitiivinen henkilötieto edellyttää osoitettavan lähteen (http(s)-URL).");
  }
  if (!input.sourceName || input.sourceName.trim().length < 2) {
    errors.push("Lähteen nimi puuttuu.");
  }
  if (input.sourceType === "SECONDARY_MEDIA" && input.confidence === "LOW") {
    errors.push("Toissijainen lähde + matala luottamus ei riitä herkkään henkilötietoon.");
  }
  if (UNRELIABLE_HOSTS.some((re) => re.test(input.sourceUrl))) {
    errors.push("Sosiaalisen median viestit eivät yksin vahvista herkkiä henkilöväitteitä.");
  }
  if (/wikipedia\.org/i.test(input.sourceUrl) && input.confidence !== "HIGH" && input.confidence !== "VERIFIED") {
    errors.push("Wikipedia ei yksinään riitä herkän henkilötiedon lähteeksi (vaaditaan HIGH/VERIFIED).");
  }
  return errors;
}

export type GuardResult = { ok: true; violations: [] } | { ok: false; violations: string[] };

export function guardOk(violations: string[]): GuardResult {
  return violations.length === 0 ? { ok: true, violations: [] } : { ok: false, violations };
}

/** Marker that a value is UNKNOWN by absence of documentation — not a guess. */
export const UNKNOWN_VALUE = "Ei vahvistettua tietoa";

export function isUnknownDocumented(value: string | null | undefined): boolean {
  return !value || value === UNKNOWN_VALUE;
}

/**
 * Absolute rules — pure markers used by the UI and methodology so the rules
 * are rendered from one source of truth.
 */
export const ABSOLUTE_RULES: { id: string; fi: string }[] = [
  { id: "no_birth_from_name", fi: "Syntymämaata ei koskaan päätellä nimestä." },
  { id: "no_origin_from_name", fi: "Syntyperää ei koskaan päätellä nimestä." },
  { id: "no_ethnicity_from_photo", fi: "Etnisyyttä ei koskaan päätellä valokuvasta." },
  { id: "no_citizenship_from_appearance", fi: "Kansalaisuutta ei koskaan päätellä ulkonäöstä." },
  { id: "no_religion_from_name", fi: "Uskontoa ei koskaan päätellä nimestä." },
  { id: "no_background_from_skin_colour", fi: "Maahanmuuttajataustaa ei koskaan päätellä ihonväristä." },
  { id: "no_identity_from_language", fi: "Kansallista identiteettiä ei koskaan päätellä kielestä." },
  { id: "no_parents_origin", fi: "Vanhempien alkuperästä ei pidetä tietoa ilman lähdettä." },
  { id: "missing_is_unknown", fi: "Jos tietoa ei ole: 'Ei vahvistettua tietoa' — ei arvausta." },
  { id: "wording_is_not_sentiment", fi: "Median sanavalinta ei ole näyttö sentimentistä eikä puolesta." },
];

/** Sentinel for "not enough data to draw a conclusion". */
export const INSUFFICIENT_SAMPLE = "INSUFFICIENT_SAMPLE";
export const MIN_ANALYSIS_SAMPLE = 5;

export function sampleSufficient(n: number): boolean {
  return n >= MIN_ANALYSIS_SAMPLE;
}