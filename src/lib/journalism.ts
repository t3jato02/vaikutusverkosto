// Journalism & media — shared constants and helpers for the "Toimittajat & media"
// feature. Role/subtype classification is a *professional* category, never a
// political stance. Labels live here (public UI must never render raw enums).

import type {
  EntityType,
  PersonalFactType,
  EvidenceGrade,
  AffiliationType,
  MediaOutletType,
  EditorialAffiliationType,
  JournalisticGenre,
  MentionRole,
  AnalysisScope,
  AnalysisKind,
} from "@prisma/client";

type Label = { fi: string; en: string };
type Lang = "fi" | "en";

// ---------------------------------------------------------------- classification

/** Journalist role subtypes (Entity.subtype on PERSON). */
export const JOURNALIST_SUBTYPES = [
  "JOURNALIST",
  "EDITOR",
  "EDITOR_IN_CHIEF",
  "COLUMNIST",
  "POLITICS_REPORTER",
  "FOREIGN_REPORTER",
  "INVESTIGATIVE_REPORTER",
  "FREELANCER",
  "COMMENTATOR",
] as const;
export type JournalistSubtype = (typeof JOURNALIST_SUBTYPES)[number];

/** Media subtypes (Entity.subtype on MEDIA_ORGANIZATION). */
export const MEDIA_SUBTYPES = [
  "MEDIA_OUTLET",
  "MEDIA_GROUP",
  "MEDIA_COMPANY",
  "PUBLISHER",
  "NEWS_AGENCY",
] as const;
export type MediaSubtype = (typeof MEDIA_SUBTYPES)[number];

const JOURNALIST_SUBTYPE_LABELS: Record<JournalistSubtype, Label> = {
  JOURNALIST: { fi: "Toimittaja", en: "Journalist" },
  EDITOR: { fi: "Toimitussihteeri / toimitustehtävä", en: "Editor" },
  EDITOR_IN_CHIEF: { fi: "Päätoimittaja", en: "Editor-in-chief" },
  COLUMNIST: { fi: "Kolumnisti", en: "Columnist" },
  POLITICS_REPORTER: { fi: "Politiikan toimittaja", en: "Politics reporter" },
  FOREIGN_REPORTER: { fi: "Ulkomaantoimittaja", en: "Foreign correspondent" },
  INVESTIGATIVE_REPORTER: { fi: "Tutkiva journalisti", en: "Investigative journalist" },
  FREELANCER: { fi: "Freelancertoimittaja", en: "Freelance journalist" },
  COMMENTATOR: { fi: "Kommentaattori", en: "Commentator" },
};

export function journalistSubtypeLabel(subtype: string | null, lang: Lang = "fi"): string {
  if (!subtype) return "Toimittaja";
  return JOURNALIST_SUBTYPE_LABELS[subtype as JournalistSubtype]?.[lang] ?? subtype;
}

export function isJournalistSubtype(subtype: string | null | undefined): boolean {
  return !!subtype && (JOURNALIST_SUBTYPES as readonly string[]).includes(subtype);
}

const MEDIA_SUBTYPE_LABELS: Record<MediaSubtype, Label> = {
  MEDIA_OUTLET: { fi: "Media", en: "Media outlet" },
  MEDIA_GROUP: { fi: "Mediakonserni", en: "Media group" },
  MEDIA_COMPANY: { fi: "Mediayhtiö", en: "Media company" },
  PUBLISHER: { fi: "Kustantaja", en: "Publisher" },
  NEWS_AGENCY: { fi: "Uutistoimisto", en: "News agency" },
};

export function mediaSubtypeLabel(subtype: string | null, lang: Lang = "fi"): string {
  if (!subtype) return "Media";
  return MEDIA_SUBTYPE_LABELS[subtype as MediaSubtype]?.[lang] ?? subtype;
}

export function isMediaSubtype(subtype: string | null | undefined): boolean {
  return !!subtype && (MEDIA_SUBTYPES as readonly string[]).includes(subtype);
}

// ---------------------------------------------------------------- evidence grade

export const EVIDENCE_GRADE_LABELS: Record<EvidenceGrade, Label & { description: string }> = {
  A: {
    fi: "Ensisijainen lähde",
    en: "Primary source",
    description: "Väite perustuu ensisijaiseen tai viralliseen lähteeseen.",
  },
  B: {
    fi: "Vahva lähde",
    en: "Strong source",
    description: "Väite perustuu vahvaan journalistiseen tai institutionaaliseen lähteeseen.",
  },
  C: {
    fi: "Usean lähteen vahvistama",
    en: "Corroborated",
    description: "Väite on usean riippumattoman lähteen tukema.",
  },
  D: {
    fi: "Yksittäinen toissijainen lähde",
    en: "Single secondary source",
    description: "Väite perustuu yhteen toissijaiseen lähteeseen.",
  },
  E: {
    fi: "Vahvistamaton",
    en: "Unverified",
    description: "Ei riittävää julkista vahvistusta — ei näytetä julkisessa näkymässä faktana.",
  },
};

export function evidenceGradeLabel(grade: EvidenceGrade, lang: Lang = "fi"): string {
  return EVIDENCE_GRADE_LABELS[grade]?.[lang] ?? grade;
}

export function evidenceGradeDescription(grade: EvidenceGrade, lang: Lang = "fi"): string {
  const e = EVIDENCE_GRADE_LABELS[grade];
  if (!e) return "";
  const desc = e.description;
  if (lang === "fi") return desc;
  return desc;
}

// ---------------------------------------------------------------- personal facts

const PERSONAL_FACT_LABELS: Record<PersonalFactType, Label> = {
  BIRTH_COUNTRY: { fi: "Synnyinmaa", en: "Country of birth" },
  NATIVE_LANGUAGE: { fi: "Äidinkieli", en: "Native language" },
  WORK_LANGUAGE: { fi: "Työkieli", en: "Working language" },
  NATIONALITY: { fi: "Kansalaisuus", en: "Nationality" },
  MOTHER_TONGUE: { fi: "Äidinkieli", en: "Mother tongue" },
};

export function personalFactLabel(t: PersonalFactType, lang: Lang = "fi"): string {
  return PERSONAL_FACT_LABELS[t]?.[lang] ?? t;
}

// ---------------------------------------------------------------- affiliations

const AFFILIATION_TYPE_LABELS: Record<AffiliationType, Label & { description: string }> = {
  DECLARED_POLITICAL_AFFILIATION: {
    fi: "Julkisesti ilmoitettu puoluesuhde",
    en: "Declared political affiliation",
    description: "Henkilön itsensä julkisesti ilmoittama puoluejäsenyys, ehdokkuus, luottamustoimi tai muu eksplisiittinen poliittinen sitoutuminen.",
  },
  DOCUMENTED_POLITICAL_RELATIONSHIP: {
    fi: "Dokumentoitu ammatillinen yhteys poliittiseen toimijaan",
    en: "Documented professional relationship",
    description: "Dokumentoitu ammatillinen tai organisatorinen yhteys poliittiseen toimijaan (esim. avustajan tai puoluejulkaisun toimittajan tehtävä).",
  },
  SELF_DESCRIBED_POLITICAL_VIEW: {
    fi: "Henkilön oma kuvaus poliittisesta näkemyksestään",
    en: "Self-described political view",
    description: "Henkilön oma, julkinen ja yksiselitteinen kuvaus omasta poliittisesta näkemyksestään. Tallenetaan sanatarkasti.",
  },
};

export function affiliationTypeLabel(t: AffiliationType, lang: Lang = "fi"): string {
  return AFFILIATION_TYPE_LABELS[t]?.[lang] ?? t;
}

export function affiliationTypeDescription(t: AffiliationType, lang: Lang = "fi"): string {
  const e = AFFILIATION_TYPE_LABELS[t];
  if (!e) return "";
  return lang === "fi" ? e.description : e.description;
}

export const AFFILIATION_REVIEW_LABELS: Record<string, Label> = {
  PENDING_REVIEW: { fi: "Odottaa tarkistusta", en: "Pending review" },
  PUBLISHED: { fi: "Julkaistu", en: "Published" },
  REJECTED: { fi: "Hylätty", en: "Rejected" },
  DISPUTED: { fi: "Riitautettu", en: "Disputed" },
};

// ---------------------------------------------------------------- media outlet

export const MEDIA_OUTLET_TYPE_LABELS: Record<MediaOutletType, Label> = {
  NEWS_PAPER: { fi: "Sanomalehti", en: "Newspaper" },
  BROADCASTER: { fi: "Radio-/TV-toimija", en: "Broadcaster" },
  MAGAZINE: { fi: "Aikakauslehti", en: "Magazine" },
  ONLINE_MEDIA: { fi: "Verkkomedia", en: "Online media" },
  NEWS_AGENCY: { fi: "Uutistoimisto", en: "News agency" },
  PARTY_MEDIA: { fi: "Puoluekanava", en: "Party media" },
  OTHER: { fi: "Muu media", en: "Other media" },
};

export function mediaOutletTypeLabel(t: MediaOutletType, lang: Lang = "fi"): string {
  return MEDIA_OUTLET_TYPE_LABELS[t]?.[lang] ?? t;
}

export const EDITORIAL_AFFILIATION_LABELS: Record<EditorialAffiliationType, Label & { description: string }> = {
  FORMALLY_PARTY_AFFILIATED: {
    fi: "Muodollisesti puoluesidonnainen",
    en: "Formally party-affiliated",
    description: "Medialla on dokumentoitu muodollinen organisaatio- tai omistussuhde puolueeseen.",
  },
  HISTORICALLY_PARTY_AFFILIATED: {
    fi: "Historiallisesti puoluesidonnainen",
    en: "Historically party-affiliated",
    description: "Median historiallinen puoluesidonnaisuus on dokumentoitu (ei välttämättä nykyhetkellä).",
  },
  INDEPENDENT: { fi: "Riippumaton", en: "Independent", description: "Media määrittelee itsensä riippumattomaksi tai lähde dokumentoi sen." },
  SELF_DESCRIBED: { fi: "Oma määritelmä", en: "Self-described", description: "Median oma julkisesti dokumentoitu määritelmä itsestään." },
  UNKNOWN: { fi: "Ei dokumentoitua linjaa", en: "Unknown", description: "Ei dokumentoitua tietoa median institutionaalisesta linjasta." },
};

export function editorialAffiliationLabel(t: EditorialAffiliationType, lang: Lang = "fi"): string {
  return EDITORIAL_AFFILIATION_LABELS[t]?.[lang] ?? t;
}

export function editorialAffiliationDescription(t: EditorialAffiliationType, lang: Lang = "fi"): string {
  const e = EDITORIAL_AFFILIATION_LABELS[t];
  return lang === "fi" ? (e?.description ?? "") : (e?.description ?? "");
}

// ---------------------------------------------------------------- articles

const GENRE_LABELS: Record<JournalisticGenre, Label> = {
  NEWS: { fi: "Uutinen", en: "News" },
  ANALYSIS: { fi: "Analyysi", en: "Analysis" },
  COMMENT: { fi: "Kommentti", en: "Comment" },
  COLUMN: { fi: "Kolumni", en: "Column" },
  OPINION: { fi: "Mielipide", en: "Opinion" },
  INVESTIGATIVE: { fi: "Tutkiva juttu", en: "Investigative" },
  INTERVIEW: { fi: "Haastattelu", en: "Interview" },
  OTHER: { fi: "Muu", en: "Other" },
};

export function genreLabel(g: JournalisticGenre | string | null, lang: Lang = "fi"): string {
  if (!g) return "Muu";
  return GENRE_LABELS[g as JournalisticGenre]?.[lang] ?? g;
}

const MENTION_ROLE_LABELS: Record<MentionRole, Label> = {
  SUBJECT: { fi: "Aihe", en: "Subject" },
  SOURCE: { fi: "Lähde", en: "Source" },
  QUOTED_EXPERT: { fi: "Asiantuntija", en: "Expert" },
  ORGANIZATION: { fi: "Organisaatio", en: "Organization" },
  COUNTRY: { fi: "Maa", en: "Country" },
  TOPIC: { fi: "Aihe", en: "Topic" },
};

export function mentionRoleLabel(r: MentionRole, lang: Lang = "fi"): string {
  return MENTION_ROLE_LABELS[r]?.[lang] ?? r;
}

// ---------------------------------------------------------------- analysis

export const ANALYSIS_SCOPE_LABELS: Record<AnalysisScope, Label> = {
  JOURNALIST: { fi: "Toimittaja", en: "Journalist" },
  MEDIA_OUTLET: { fi: "Media", en: "Media outlet" },
  CORPUS: { fi: "Aineisto", en: "Corpus" },
  TOPIC: { fi: "Aihe", en: "Topic" },
};

export const ANALYSIS_KIND_LABELS: Record<AnalysisKind, Label> = {
  COVERAGE_METRICS: { fi: "Käsittelymittarit", en: "Coverage metrics" },
  PARTY_COVERAGE: { fi: "Puolueiden käsittely", en: "Party coverage" },
  PERSON_COVERAGE: { fi: "Henkilöiden käsittely", en: "Person coverage" },
  GENRE_DISTRIBUTION: { fi: "Juttutyyppijakauma", en: "Genre distribution" },
  TOPIC_DISTRIBUTION: { fi: "Aihejakauma", en: "Topic distribution" },
  COUNTRY_DISTRIBUTION: { fi: "Maiden käsittely", en: "Country distribution" },
  SOURCE_TYPE_DISTRIBUTION: { fi: "Lähdetyyppijakauma", en: "Source-type distribution" },
  FRAMING_DISTRIBUTION: { fi: "Kehystysjakauma", en: "Framing distribution" },
  MEDIA_COMPARISON: { fi: "Medioiden vertailu", en: "Media comparison" },
};

export function analysisKindLabel(k: AnalysisKind, lang: Lang = "fi"): string {
  return ANALYSIS_KIND_LABELS[k]?.[lang] ?? k;
}

export function analysisScopeLabel(s: AnalysisScope, lang: Lang = "fi"): string {
  return ANALYSIS_SCOPE_LABELS[s]?.[lang] ?? s;
}

// ---------------------------------------------------------------- helpers

/** Type-label caption used under names in search/index/profile headers. */
export function journalistCaption(subtype: string | null, employer?: string | null, lang: Lang = "fi"): string {
  const role = journalistSubtypeLabel(subtype, lang);
  return employer ? `${role} · ${employer}` : role;
}

/** A concise, neutral description for ArticleMention lists. */
export function entityTypeLabelText(type: EntityType, lang: Lang = "fi"): string {
  switch (type) {
    case "PERSON": return lang === "fi" ? "Henkilö" : "Person";
    case "MEDIA_ORGANIZATION": return lang === "fi" ? "Media" : "Media";
    case "POLITICAL_PARTY": return lang === "fi" ? "Puolue" : "Party";
    case "COMPANY": return lang === "fi" ? "Yritys" : "Company";
    case "GOVERNMENT_BODY": return lang === "fi" ? "Julkisyhteisö" : "Government body";
    default: return lang === "fi" ? "Organisaatio" : "Organization";
  }
}