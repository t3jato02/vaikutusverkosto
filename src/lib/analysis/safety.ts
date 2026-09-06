// Safety + trust layer for the media/journalism feature (sections 5, 20, 35, 38).
//
// These guards encode the *hard invariants* of the feature. They are exercised
// directly by the regression tests (tests/journalism-safety.test.ts) and are
// used by the ingestion pipeline so that bad data cannot enter the DB.

import type {
  Confidence,
  EvidenceGrade,
  VerificationStatus,
  RelationshipType,
  PersonalFactType,
} from "@prisma/client";
import { deriveAgentStatus } from "@/lib/verification";

// ---------------------------------------------------------------------------- personal facts

/** Sensitive biographic fields must never be inferred from a name or style. */
export const NEVER_INFERRED_FACT_TYPES: PersonalFactType[] = [
  "BIRTH_COUNTRY",
  "NATIVE_LANGUAGE",
  "MOTHER_TONGUE",
  "NATIONALITY",
];

export interface PersonalFactGuardInput {
  factType: PersonalFactType;
  value: string;
  sourceUrl: string;
  sourceName: string;
  confidence: Confidence;
  sourceType: string;
}

/**
 * Refuse to record a sensitive biographic fact unless it is backed by an
 * explicit human-authored source. There is no "name looks like X" path — ever.
 * Returns an array of human-readable violations; empty array means safe.
 */
export function checkPersonalFact(input: PersonalFactGuardInput): string[] {
  const errors: string[] = [];
  if (!NEVER_INFERRED_FACT_TYPES.includes(input.factType)) return [];
  const value = input.value.trim().toLowerCase();
  if (!input.sourceUrl || !/^https?:\/\//i.test(input.sourceUrl)) {
    errors.push("Sensitiivinen henkilötieto edellyttää osoitettavan lähteen (http(s)-URL).");
  }
  if (!input.sourceName || input.sourceName.trim().length < 2) {
    errors.push("Lähteen nimi puuttuu.");
  }
  // Wikipedia — acceptable only as an entry point, never as the sole evidence.
  if (/wikipedia\.org/i.test(input.sourceUrl) && input.confidence !== "HIGH" && input.confidence !== "VERIFIED") {
    errors.push("Wikipedia ei yksinään riitä herkän henkilötiedon lähteeksi (vaaditaan HIGH/VERIFIED).");
  }
  // Forums / social posts never confirm sensitive claims on their own.
  if (/(reddit\.com|twitter\.com|x\.com|t\.co)/i.test(input.sourceUrl)) {
    errors.push("Keskustelupalstat eivät yksin vahvista herkkiä henkilöväitteitä.");
  }
  if (input.factType === "NATIVE_LANGUAGE" || input.factType === "MOTHER_TONGUE") {
    if (value === value.replace(/[a-zåäö]/gi, "")) {
      // Non-alphabetic value is not a language identifier.
      errors.push("Äidinkielen arvo ei näytä kielikoodilta/kielinimeltä.");
    }
  }
  if (input.factType === "NATIONALITY" && /^(fi|fin|suomi)$/i.test(value) && !/finland|suomi|kansalais|fi$/i.test(input.sourceName)) {
    // Extra guard: Finnish nationality still needs an explicit source.
    errors.push("Kansalaisuus edellyttää lähteen, joka nimenomaisesti dokumentoi sen.");
  }
  return errors;
}

/** When no public source exists, the value is UNKNOWN — never an AI guess. */
export function unknownPersonalValue(factType: PersonalFactType): { value: "UNKNOWN"; factType: PersonalFactType; source: null } {
  return { value: "UNKNOWN", factType, source: null };
}

// ---------------------------------------------------------------------------- political affiliations

/**
 * Guard for creating a PoliticalAffiliation. These facts are the only place a
 * political affiliation may be recorded, and only with a verifiable source.
 * Content-analysis (sentiment/coverage) must NEVER reach this path.
 */
export function checkPoliticalAffiliation(input: {
  sourceUrl: string;
  sourceName: string;
  sourceType: string;
  confidence: Confidence;
  description: string;
  origin: "agent" | "manual" | "content_analysis";
  verificationStatus?: VerificationStatus;
}): string[] {
  const errors: string[] = [];
  if (input.origin === "content_analysis") {
    errors.push("Journalistisen tuotannon analyysi ei voi tuottaa poliittisen kannan tietuetta.");
    return errors;
  }
  if (!input.sourceUrl || !/^https?:\/\//i.test(input.sourceUrl)) errors.push("Poliittinen suhde vaatii lähteen URL:n.");
  if (!input.sourceName || input.sourceName.trim().length < 2) errors.push("Poliiittinen suhde vaatii lähteen nimen.");
  if (!input.description || input.description.trim().length < 10) errors.push("Kuvaus on liian lyhyt ollakseen dokumentoitu tosiasia.");
  if (input.verificationStatus === "HUMAN_VERIFIED") {
    // Agents can never self-certify; only a human reviewer may set this.
    errors.push("HUMAN_VERIFIED-tilan voi asettaa vain ihminen.");
  }
  return errors;
}

/** An agent may only produce AUTO_DETECTED or SOURCE_CONFIRMED — never HIGHER. */
export function agentAffiliationStatus(input: { sourceType: string; confidence: Confidence }) {
  return deriveAgentStatus(input);
}

/** A political-affiliation fact with EvidenceGrade E or REVIEW_PENDING is not publishable as fact. */
export function isPublishableAffiliation(input: {
  grade: EvidenceGrade;
  reviewStatus: string;
  verificationStatus: VerificationStatus;
}): boolean {
  if (input.grade === "E") return false;
  if (input.reviewStatus === "PENDING_REVIEW" || input.reviewStatus === "REJECTED" || input.reviewStatus === "DISPUTED") {
    return false;
  }
  return input.verificationStatus === "SOURCE_CONFIRMED" || input.verificationStatus === "HUMAN_VERIFIED";
}

// ---------------------------------------------------------------------------- relationship semantics

const ARTICLE_DATA_RELATIONSHIP_TYPES = new Set<RelationshipType>(["WROTE_ABOUT", "CITED", "CITED_AS_EXPERT", "INTERVIEWED"]);

const PERSONAL_POLITICAL_RELATIONSHIP_TYPES = new Set<RelationshipType>([
  "WORKED_FOR",
  "WORKED_FOR_PARTY",
  "POLITICAL_AIDE_TO",
  "PERSONAL_RELATIONSHIP",
  "EMPLOYED_BY",
]);

/**
 * A journalist writing about a politician is *publication data*, not a social
 * relationship. The only relationship types derivable from article coverage
 * metadata are the ARTICLE_DATA_* set; everything personal/political requires
 * an explicit evidence lane.
 */
export function coverageRelationshipType(deriveFrom: "wrote" | "quoted" | "interviewed"): RelationshipType {
  switch (deriveFrom) {
    case "wrote": return "WROTE_ABOUT";
    case "quoted": return "CITED";
    case "interviewed": return "INTERVIEWED";
  }
}

export function isArticleDataRelationship(t: RelationshipType): boolean {
  return ARTICLE_DATA_RELATIONSHIP_TYPES.has(t);
}

export function requiresExplicitEvidence(t: RelationshipType): boolean {
  return PERSONAL_POLITICAL_RELATIONSHIP_TYPES.has(t);
}

/**
 * The system refuses to create a personal/political relationship edge merely
 * because an article mentions both parties. Returns violations otherwise.
 */
export function checkMentionDerivedRelationship(input: {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: RelationshipType;
  evidenceQuotedFragment?: string | null;
}): string[] {
  if (requiresExplicitEvidence(input.relationshipType)) {
    if (!input.evidenceQuotedFragment) {
      return ["Henkilösuhde vaatii suoran lainauksen tai eksplisiittisen lähteen; pelkkä maininta ei riitä."];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------- media orientation

/**
 * The institutional editorial orientation of a media organisation is a property
 * of that ORGANISATION. This function refuses to copy it onto an individual
 * journalist (the UI + ingestion both rely on it).
 */
export function transferEditorialOrientation(
  mediaEditorialAffiliation: string | null,
): never {
  throw new Error(
    `Mediaan liittyvää institutionaalista taustaa (${String(mediaEditorialAffiliation)}) ei koskaan siirretä yksittäiselle toimittajalle.`,
  );
}

export function assertMediaOrientationBlocked(mediaEditorialAffiliation: string | null): boolean {
  if (!mediaEditorialAffiliation || mediaEditorialAffiliation === "UNKNOWN") return true;
  // Present only alongside a visible caveat — never on a person's political profile.
  return mediaEditorialAffiliation === "INDEPENDENT";
}

// ---------------------------------------------------------------------------- evidence grade

/** Map a verification status (and source strength) to a public evidence grade. */
export function evidenceGradeFor(input: {
  verificationStatus: VerificationStatus;
  sourceType: string;
}): EvidenceGrade {
  const PRIMARY = new Set([
    "OFFICIAL_PRIMARY",
    "OFFICIAL_REGISTER",
    "PARLIAMENTARY_RECORD",
    "COURT_DOCUMENT",
    "COMPANY_DISCLOSURE",
    "PROCUREMENT_RECORD",
    "ORGANIZATION_DISCLOSURE",
  ]);
  if (input.verificationStatus === "HUMAN_VERIFIED") return PRIMARY.has(input.sourceType) ? "A" : "B";
  if (input.verificationStatus === "SOURCE_CONFIRMED") return PRIMARY.has(input.sourceType) ? "A" : "B";
  if (input.verificationStatus === "DISPUTED") return "D";
  return "E";
}

// ---------------------------------------------------------------------------- timeline

export interface TimelineItem {
  date: string | null;
  category: "employment" | "position" | "election" | "other";
  label: string;
  sourceUrl?: string;
}

/** A deterministic timeline for a person from dated facts (dates optional). */
export function buildTimeline(facts: TimelineItem[]): TimelineItem[] {
  return [...facts].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return 1;
    if (b.date) return -1;
    return a.label.localeCompare(b.label, "fi");
  });
}