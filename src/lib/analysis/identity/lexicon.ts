// Identity-framing term lexicon (Syntymämaa & media-identiteetti, luku 3).
//
// The lexicon classifies the TYPE OF EXPRESSION the media uses (nationality
// ethnonym, legal citizenship, residence, place of birth, immigration status,
// city identity…), never the person. Matching is deterministic, case-folded,
// word-boundary based and limited to common Finnish inflections. The verbatim
// expression found in the source is always stored as-is.

import type { MediaIdentityTermCategory } from "@prisma/client";

export interface IdentityTermDef {
  /** Stable identifier for the term class. */
  id: string;
  category: MediaIdentityTermCategory;
  /** Normalized display label (lowercase). */
  label: string;
  /** Inflected / multiword forms to match (lowercase). */
  forms: string[];
  /** ISO-3166 alpha-2 country the ethnonym refers to, when applicable. */
  countryOfReference?: string;
}

// Finnish case endings handled by the matcher in addition to the exact forms.
// Together they cover the common inflections of *_lainen adjectives that
// appear in headlines and ledes (suomalainen / suomalaista / suomalaisten /
// suomalaisessa / suomalaiseksi …).
const CASE_SUFFIXES = [
  "", "en", "ta", "essa", "esta", "ella", "elta", "elle", "ena", "eksi",
  "et", "ten", "ia", "eseen", "eja", "ejä", "eille",
];

function formsFromStem(stem: string): string[] {
  return CASE_SUFFIXES.map((c) => stem + c);
}

const COUNTRY_ETHNONYMS: { id: string; label: string; country: string; stems: string[] }[] = [
  { id: "ethnonym_fi", label: "suomalainen", country: "FI", stems: ["suomalais", "suomalainen"] },
  { id: "ethnonym_se", label: "ruotsalainen", country: "SE", stems: ["ruotsalainen", "ruotsalais"] },
  { id: "ethnonym_no", label: "norjalainen", country: "NO", stems: ["norjalainen", "norjalais"] },
  { id: "ethnonym_dk", label: "tanskalainen", country: "DK", stems: ["tanskalainen", "tanskalais"] },
  { id: "ethnonym_de", label: "saksalainen", country: "DE", stems: ["saksalainen", "saksalais"] },
  { id: "ethnonym_fr", label: "ranskalainen", country: "FR", stems: ["ranskalainen", "ranskalais"] },
  { id: "ethnonym_uk", label: "brittiläinen", country: "GB", stems: ["brittiläinen", "brittiläis"] },
  { id: "ethnonym_us", label: "amerikkalainen", country: "US", stems: ["amerikkalainen", "amerikkalais", "yhdysvaltalainen", "yhdysvaltalais"] },
  { id: "ethnonym_ru", label: "venäläinen", country: "RU", stems: ["venäläinen", "venäläis"] },
  { id: "ethnonym_ee", label: "virolainen", country: "EE", stems: ["virolainen", "virolais"] },
  { id: "ethnonym_np", label: "nepalilainen", country: "NP", stems: ["nepalilainen", "nepalilais", "nepalilaistaustainen"] },
  { id: "ethnonym_af", label: "afganistanilainen", country: "AF", stems: ["afganistanilainen", "afganistanilais", "afganistanilaissyntyinen"] },
  { id: "ethnonym_so", label: "somalialainen", country: "SO", stems: ["somalialainen", "somalialais"] },
  { id: "ethnonym_et", label: "etiopialainen", country: "ET", stems: ["etiopialainen", "etiopialais"] },
  { id: "ethnonym_cn", label: "kiinalainen", country: "CN", stems: ["kiinalainen", "kiinalais"] },
  { id: "ethnonym_ua", label: "ukrainalainen", country: "UA", stems: ["ukrainalainen", "ukrainalais"] },
  { id: "ethnonym_iq", label: "irakilainen", country: "IQ", stems: ["irakilainen", "irakilais"] },
  { id: "ethnonym_ir", label: "iranilainen", country: "IR", stems: ["iranilainen", "iranilais"] },
  { id: "ethnonym_pk", label: "pakistanilainen", country: "PK", stems: ["pakistanilainen", "pakistanilais"] },
  { id: "ethnonym_in", label: "intialainen", country: "IN", stems: ["intialainen", "intialais"] },
  { id: "ethnonym_th", label: "thaimaalainen", country: "TH", stems: ["thaimaalainen", "thaimaalais"] },
  { id: "ethnonym_it", label: "italialainen", country: "IT", stems: ["italialainen", "italialais"] },
  { id: "ethnonym_es", label: "espanjalainen", country: "ES", stems: ["espanjalainen", "espanjalais"] },
];

export const ETHNONYM_TERMS: IdentityTermDef[] = COUNTRY_ETHNONYMS.map((c) => ({
  id: c.id,
  category: "NATIONALITY" as const,
  label: c.label,
  countryOfReference: c.country,
  forms: c.stems.flatMap((s) => formsFromStem(s)),
}));

// Finnish municipality / city identities (paikallisuus, luku 5).
const CITY_IDENTITIES: { id: string; label: string; stems: string[] }[] = [
  { id: "city_helsinki", label: "helsinkiläinen", stems: ["helsinkiläinen", "helsinkiläis"] },
  { id: "city_turku", label: "turkulainen", stems: ["turkulainen", "turkulais"] },
  { id: "city_tampere", label: "tamperelainen", stems: ["tamperelainen", "tamperelais"] },
  { id: "city_oulu", label: "oululainen", stems: ["oululainen", "oululais"] },
  { id: "city_espoo", label: "espoolainen", stems: ["espoolainen", "espoolais"] },
  { id: "city_vantaa", label: "vantaalainen", stems: ["vantaalainen", "vantaalais"] },
  { id: "city_jyvaskyla", label: "jyväskyläläinen", stems: ["jyväskyläläinen", "jyväskyläläis"] },
  { id: "city_kuopio", label: "kuopiolainen", stems: ["kuopiolainen", "kuopiolais"] },
  { id: "city_lahti", label: "lahtelainen", stems: ["lahtelainen", "lahtelais"] },
  { id: "city_pori", label: "porilainen", stems: ["porilainen", "porilais"] },
  { id: "city_joensuu", label: "joensuulainen", stems: ["joensuulainen", "joensuulais"] },
];

export const CITY_TERMS: IdentityTermDef[] = CITY_IDENTITIES.map((c) => ({
  id: c.id,
  category: "CITY_IDENTITY" as const,
  label: c.label,
  forms: c.stems.flatMap((s) => formsFromStem(s)),
}));

// Multiword / status expressions.
export const PHRASE_TERMS: IdentityTermDef[] = [
  { id: "citizenship_fi", category: "CITIZENSHIP", label: "suomen kansalainen", forms: ["suomen kansalainen", "suomen kansalaiseksi", "suomen kansalaista", "suomen kansalaisen", "suomen kansalaisuuden"] },
  { id: "citizenship_statement", category: "CITIZENSHIP", label: "kansalaisuuden saanut", forms: ["kansalaisuuden saanut", "sai suomen kansalaisuuden"] },
  { id: "residence_fi", category: "RESIDENCE", label: "suomessa asuva", forms: ["suomessa asuva", "suomessa asuvat", "suomessa asuvaa"] },
  { id: "residence_fi_statement", category: "RESIDENCE", label: "asuva suomessa", forms: ["asuva suomessa", "asuu suomessa", "asuu helsingissä", "asuu tampereella"] },
  { id: "place_of_birth_fi", category: "PLACE_OF_BIRTH", label: "suomessa syntynyt", forms: ["suomessa syntynyt", "suomeen syntynyt", "syntynyt suomessa"] },
  { id: "place_of_birth_abroad", category: "PLACE_OF_BIRTH", label: "ulkomailla syntynyt", forms: ["ulkomailla syntynyt", "syntynyt ulkomailla"] },
  { id: "immigration_fi", category: "IMMIGRATION_STATUS", label: "ulkomaalaistaustainen", forms: ["ulkomaalaistaustainen", "ulkomaalaistaustaista", "ulkomaalaistaustaiset"] },
  { id: "immigration_fi_bg", category: "IMMIGRATION_STATUS", label: "suomalaistaustainen", forms: ["suomalaistaustainen", "suomalaistaustaista"] },
  { id: "immigration_immigrant", category: "IMMIGRATION_STATUS", label: "maahanmuuttaja", forms: ["maahanmuuttaja", "maahanmuuttajan", "maahanmuuttajataustainen", "maahanmuuttajataustaista"] },
  { id: "immigration_refugee", category: "IMMIGRATION_STATUS", label: "pakolainen", forms: ["pakolainen", "pakolaistausta", "pakolaisena"] },
  { id: "immigration_asylum", category: "IMMIGRATION_STATUS", label: "turvapaikanhakija", forms: ["turvapaikanhakija", "turvapaikanhakijan"] },
  { id: "immigration_roots", category: "IMMIGRATION_STATUS", label: "juuret ulkomailla", forms: ["juuret ulkomailla"] },
];

export const IDENTITY_TERMS: IdentityTermDef[] = [...ETHNONYM_TERMS, ...CITY_TERMS, ...PHRASE_TERMS];

// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface CompiledTerm {
  def: IdentityTermDef;
  /** Matches the term within a normalized sentence. */
  regex: RegExp;
}

/** Pre-compile all terms once (deterministic order). */
export const COMPILED_TERMS: CompiledTerm[] = IDENTITY_TERMS.map((def) => ({
  def,
  regex: new RegExp("(?:^|[^\\p{L}])(" + def.forms.map(escapeRegExp).join("|") + ")(?=[^\\p{L}]|$)", "iu"),
}));

export interface MatchedTerm {
  def: IdentityTermDef;
  /** Verbatim substring from the source text (original casing). */
  verbatim: string;
  expressionNormalized: string;
}

/**
 * Find all identity terms present in a text. `text` is the original casing
 * source; `normalized` is its case-folded, whitespace-collapsed form.
 */
export function matchIdentityTerms(text: string, normalized: string): MatchedTerm[] {
  const out: MatchedTerm[] = [];
  for (const compiled of COMPILED_TERMS) {
    const m = compiled.regex.exec(normalized);
    if (m && m[1]) {
      const lower = text.toLowerCase();
      const idx = lower.indexOf(m[1].toLowerCase());
      const verbatim = idx >= 0 ? text.slice(idx, idx + m[1].length) : m[1];
      out.push({
        def: compiled.def,
        verbatim,
        expressionNormalized: m[1].toLowerCase().replace(/\s+/g, " ").trim(),
      });
    }
  }
  return out;
}