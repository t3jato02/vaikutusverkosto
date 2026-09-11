// Deterministic institutional classification from the official name + jurisdiction.
//
// A rule engine over the canonical name string and legal-form suffixes — NOT an
// LLM guess. Returns a category only when a rule fires unambiguously; otherwise
// null and the caller leaves the field untouched. Used to lift NULL / OTHER
// categories to a stronger value, never to overwrite a more-specific one.
//
// Name strings in the data are multi-lingual concatenations from official
// exports, often ASCII-folded ("TERVEYDEN JA HYVINVOINNIN LAITOS*FINNISH
// INSTITUTE FOR HEALTH AND WELFARE"). We fold to lowercase ASCII before matching
// and write every rule in ASCII.

import type { EntityCategory } from "@prisma/client";

export interface ClassifyInput {
  name: string;
  countryCode?: string | null;
  jurisdiction?: string | null;
}

/** lowercase + strip Nordic diacritics so rules can be written in plain ASCII. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

const SOVEREIGN = /(^|\W)(republic of finland|republique de finlande|suomen tasavalta|suomen valtio)(\W|$)/;
const MINISTRY = /ministeri(o|ot|et)\b|\bministry of\b|\bministere\b|\bministeriet\b|valtioneuvoston kanslia|prime minister'?s office/;

const INTL =
  /\beuropean\b[^*]*\b(agency|institute|commission|consortium|centre|center|foundation)\b|\b(agency|institute|commission)\b[^*]*\beuropean\b|\becha\b|\befsa\b|\bema\b|european commission|euroopan komissio|\boecd\b|\bunesco\b|\bunicef\b|\bnordic\b[^*]*\b(council|bank|corporation|fund|investment)\b|\bworld bank\b|united nations|\bnato\b|\beit\b|\beric\b|\bhelcom\b|baltic marine environment protection/;

const UNIVERSITY =
  /\byliopisto\b|\buniversity\b|\buniversite\b|\buniversitet\b|hogskola|\bkorkeakoulu\b|ammattikorkeakoulu|university of applied sciences|\bpolytechnic\b|korkeakoulusaatio|\baalto\b|\bhanken\b|\bakademi\b/;

// Municipal / regional public bodies (joint authorities, regional councils,
// cities, wellbeing counties, hospital districts). Public administration, not
// associations — matched before the NGO rule.
const MUNICIPAL =
  /\bkuntayhtyma\b|\bmaakunta\b|\bmaakunnan liitto\b|(^|[\s,*])kaupunki([\s,*]|$)|city of\b|(^|[\s,*])kunta([\s,*]|$)|\bregional council\b|\bjoint (municipal )?authority\b|kunnan liikelaitos|\bhyvinvointialue\b|wellbeing services county|\bsairaanhoitopiiri\b|\bhus-yhtyma\b/;

// Finnish state agencies, authorities and state research institutes.
const AGENCY =
  /\bvirasto\b|\btutkimuskeskus\b|\bkeskusvirasto\b|rahoituskeskus|\blaitos\b|luonnonvarakeskus|natural resources institute|institute for health and welfare|geological survey|\bvtt\b|teknologian tutkimuskeskus|opetushallitus|national agency for education|verohallinto|tax administration|vaylavirasto|transport infrastructure agency|huoltovarmuuskeskus|national emergency supply|ruokavirasto|finnish food authority|\btraficom\b|kansanelakelaitos|social insurance institution|tilastokeskus|statistics finland|kansallisarkisto|national archives|museovirasto|heritage agency|metsahallitus|\bsenaatti\b|puolustusvoimat|defence forces|\bpoliisi\b|keskusrikospoliisi|pelastusopisto|emergency services academy|maanmittauslaitos|\btulli\b|board of customs|national board of customs|elinkeino-,? liikenne|\bely-keskus\b|centre for economic development|aluehallintovirasto|regional state administrative|suomen ymparistokeskus|finnish environment institute|suomen metsakeskus|finnish forest centre|geologian tutkimuskeskus|ilmatieteen laitos|finnish meteorological|csc-tieteen/;

// "sr" = säätiö rekisteröity (FI/SV registered foundation). NOT "rs", which is
// the Northern Sámi "registrejuvvon searvi" = registered association.
const FOUNDATION = /\bsaatio\b|\bfoundation\b|\bstiftelse\b|\bfonden\b|[\s*]sr\b/;

const NGO =
  /(^|[\s*])r\.?y\.?($|[\s.*])|(^|[\s*])r\.?f\.?($|[\s.*])|[\s*]rs\b|\byhdistys\b|\bforening\b|\bassociation\b|\bforbund\b|\bliitto\b|\bseura\b|\bjarjesto\b|\bsociety\b|\bfederation\b/;

const COMPANY = /(^|[\s*])(oy|oyj|ab|abp|ltd|plc|gmbh|inc|corp|corporation|a\/s|as|ky|kb|se)(\.|[\s*]|$)/;

const PARTY = /\bpuolue\b|\bpolitical party\b|(^|[\s*])r\.?p\.?($|[\s.*])/;
const RELIGIOUS = /\bseurakunta\b|\bkirkko\b|\bchurch\b|\bparish\b|\bdiocese\b|hiippakunta|\bforsamling\b/;
const MEDIA = /\byleisradio\b|broadcasting company|\bsanomat\b|\bnewspaper\b/;

/**
 * Classify an organisation. Returns null when no rule fires unambiguously.
 * GOVERNMENT is only returned for the sovereign state or a ministry — never
 * inferred from sector/country.
 */
export function classifyEntityCategory(input: ClassifyInput): EntityCategory | null {
  const n = fold(input.name ?? "");
  if (n.trim().length < 2) return null;

  if (SOVEREIGN.test(n) || MINISTRY.test(n)) return "GOVERNMENT";

  const intlHint = /\beuropean\b|euroopan|\bnordic\b|united nations|\binternational\b/.test(n);
  const intlJurisdiction =
    ["EU", "INT", "INTL"].includes((input.jurisdiction ?? "").toUpperCase()) ||
    (input.countryCode ?? "").toUpperCase() === "EU";
  if (INTL.test(n) && (intlHint || intlJurisdiction)) return "INTERNATIONAL_ORGANIZATION";

  if (UNIVERSITY.test(n)) return "UNIVERSITY";
  if (RELIGIOUS.test(n)) return "RELIGIOUS_ORGANIZATION";
  if (PARTY.test(n)) return "POLITICAL_PARTY";
  if (MUNICIPAL.test(n)) return "GOVERNMENT_AGENCY";
  if (AGENCY.test(n)) return "GOVERNMENT_AGENCY";
  if (MEDIA.test(n)) return "MEDIA_ORGANIZATION";
  if (FOUNDATION.test(n)) return "FOUNDATION";
  if (NGO.test(n)) return "NGO";
  if (COMPANY.test(n)) return "COMPANY";

  return null;
}

/** Categories weak enough to be replaced by a rule match. */
export const REPLACEABLE_CATEGORIES = new Set<EntityCategory | null>([null, "OTHER"]);
