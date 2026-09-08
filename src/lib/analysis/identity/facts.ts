// Identity-fact reading/writing layer (luvut 1, 2, 6).
//
// Birth origin, citizenship, residence and self-identification are four
// SEPARATE fact types with full provenance (sourceUrl, sourceName,
// publicationDate, retrievedAt, evidenceGrade, confidence, verification status)
// and an explicit review lifecycle. Writing is only allowed through the guard
// functions in safety.ts — a fact can never be derived from a name.

import type { Confidence, EvidenceGrade, IdentityReviewStatus, VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { checkSensitiveFact, guardOk, type GuardResult } from "./safety";

export interface ProvenanceInput {
  sourceUrl: string;
  sourceName: string;
  sourceType: string;
  publicationDate?: Date | string | null;
  retrievedAt?: Date | null;
  confidence?: Confidence;
  verificationStatus?: VerificationStatus;
  evidenceGrade?: EvidenceGrade;
  reviewStatus?: IdentityReviewStatus;
  createdBy?: string;
  note?: string;
}

// ---------------------------------------------------------------- countries

/** Minimal ISO2 → Finnish name fallback (Country table is authoritative). */
const COUNTRY_FALLBACK: Record<string, string> = {
  FI: "Suomi",
  AF: "Afganistan",
  NP: "Nepal",
  SO: "Somalia",
  ET: "Etiopia",
  SE: "Ruotsi",
  NO: "Norja",
  DK: "Tanska",
  DE: "Saksa",
  FR: "Ranska",
  GB: "Iso-Britannia",
  US: "Yhdysvallat",
  RU: "Venäjä",
  EE: "Viro",
  CN: "Kiina",
  UA: "Ukraina",
  IQ: "Irak",
  IR: "Iran",
  PK: "Pakistan",
  IN: "Intia",
  TH: "Thaimaa",
  IT: "Italia",
  ES: "Espanja",
};

export async function countryNameFor(iso2: string | null | undefined): Promise<string | null> {
  if (!iso2) return null;
  const row = await db.country.findUnique({ where: { iso2: iso2.toUpperCase() }, select: { name: true } });
  if (row) return row.name;
  return COUNTRY_FALLBACK[iso2.toUpperCase()] ?? null;
}

export function fixedCountryName(iso2: string): string {
  return COUNTRY_FALLBACK[iso2.toUpperCase()] ?? iso2.toUpperCase();
}

// ------------------------------------------------------------ guards + writers

export interface WriteBirthOriginInput extends ProvenanceInput {
  personEntityId: string;
  factKind: "BIRTH_COUNTRY" | "BIRTH_PLACE";
  value: string; // ISO2 for BIRTH_COUNTRY, place name for BIRTH_PLACE
  displayValue: string;
}

export async function writeBirthOriginFact(input: WriteBirthOriginInput): Promise<GuardResult & { id?: string }> {
  const g = guardOk(checkSensitiveFact({ ...input, confidence: input.confidence ?? "HIGH" }));
  if (!g.ok) return g;
  const created = await db.birthOriginFact.upsert({
    where: {
      personEntityId_factKind_value_sourceUrl: {
        personEntityId: input.personEntityId,
        factKind: input.factKind,
        value: input.value,
        sourceUrl: input.sourceUrl,
      },
    },
    create: {
      personEntityId: input.personEntityId,
      factKind: input.factKind,
      value: input.value,
      displayValue: input.displayValue,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
      retrievedAt: input.retrievedAt ?? new Date(),
      confidence: input.confidence ?? "HIGH",
      verificationStatus: input.verificationStatus ?? "SOURCE_CONFIRMED",
      evidenceGrade: input.evidenceGrade ?? "C",
      reviewStatus: input.reviewStatus ?? "PENDING_REVIEW",
      createdBy: input.createdBy,
      note: input.note,
    },
    update: {},
  });
  return { ok: true, violations: [], id: created.id };
}

export interface WriteCitizenshipInput extends ProvenanceInput {
  personEntityId: string;
  countryCode: string;
  status?: "CURRENT" | "FORMER" | "UNKNOWN";
  acquiredYear?: number | null;
  endedYear?: number | null;
}

export async function writeCitizenshipFact(input: WriteCitizenshipInput): Promise<GuardResult & { id?: string }> {
  const g = guardOk(checkSensitiveFact({ ...input, confidence: input.confidence ?? "HIGH" }));
  if (!g.ok) return g;
  const status = input.status ?? "CURRENT";
  const created = await db.citizenshipFact.upsert({
    where: {
      personEntityId_countryCode_status_sourceUrl: {
        personEntityId: input.personEntityId,
        countryCode: input.countryCode.toUpperCase(),
        status,
        sourceUrl: input.sourceUrl,
      },
    },
    create: {
      personEntityId: input.personEntityId,
      countryCode: input.countryCode.toUpperCase(),
      countryName: (await countryNameFor(input.countryCode)) ?? fixedCountryName(input.countryCode),
      status,
      acquiredYear: input.acquiredYear ?? null,
      endedYear: input.endedYear ?? null,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
      retrievedAt: input.retrievedAt ?? new Date(),
      confidence: input.confidence ?? "HIGH",
      verificationStatus: input.verificationStatus ?? "SOURCE_CONFIRMED",
      evidenceGrade: input.evidenceGrade ?? "C",
      reviewStatus: input.reviewStatus ?? "PENDING_REVIEW",
      createdBy: input.createdBy,
      note: input.note,
    },
    update: {},
  });
  return { ok: true, violations: [], id: created.id };
}

export interface WriteResidenceInput extends ProvenanceInput {
  personEntityId: string;
  countryCode?: string | null;
  municipality?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isCurrent?: boolean;
}

export async function writeResidenceFact(input: WriteResidenceInput): Promise<GuardResult & { id?: string }> {
  const g = guardOk(checkSensitiveFact({ ...input, confidence: input.confidence ?? "HIGH" }));
  if (!g.ok) return g;
  const countryCode = input.countryCode?.toUpperCase() ?? null;
  const start = input.startDate ? new Date(input.startDate) : null;
  const end = input.endDate ? new Date(input.endDate) : null;
  // The compound unique index is on nullable columns (Postgres treats NULLs as
  // distinct), so existence is checked with findFirst instead of an upsert key.
  const existing = await db.residenceFact.findFirst({
    where: {
      personEntityId: input.personEntityId,
      countryCode,
      municipality: input.municipality ?? null,
      startDate: start,
      endDate: end,
      sourceUrl: input.sourceUrl,
    },
  });
  if (existing) return { ok: true, violations: [], id: existing.id };
  const created = await db.residenceFact.create({
    data: {
      personEntityId: input.personEntityId,
      countryCode,
      countryName: countryCode ? ((await countryNameFor(countryCode)) ?? fixedCountryName(countryCode)) : null,
      municipality: input.municipality ?? null,
      startDate: start,
      endDate: end,
      isCurrent: input.isCurrent ?? false,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
      retrievedAt: input.retrievedAt ?? new Date(),
      confidence: input.confidence ?? "HIGH",
      verificationStatus: input.verificationStatus ?? "SOURCE_CONFIRMED",
      evidenceGrade: input.evidenceGrade ?? "C",
      reviewStatus: input.reviewStatus ?? "PENDING_REVIEW",
      createdBy: input.createdBy,
      note: input.note,
    },
  });
  return { ok: true, violations: [], id: created.id };
}

export interface WriteSelfIdInput extends ProvenanceInput {
  personEntityId: string;
  identityLabel: string;
  verbatimText: string;
  language?: string | null;
}

export async function writeSelfIdentificationFact(input: WriteSelfIdInput): Promise<GuardResult & { id?: string }> {
  const g = guardOk(checkSensitiveFact({ ...input, confidence: input.confidence ?? "HIGH" }));
  if (!g.ok) return g;
  const created = await db.selfIdentificationFact.upsert({
    where: {
      personEntityId_identityLabel_sourceUrl: {
        personEntityId: input.personEntityId,
        identityLabel: input.identityLabel.toLowerCase().trim(),
        sourceUrl: input.sourceUrl,
      },
    },
    create: {
      personEntityId: input.personEntityId,
      identityLabel: input.identityLabel.toLowerCase().trim(),
      verbatimText: input.verbatimText.trim(),
      language: input.language ?? null,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
      retrievedAt: input.retrievedAt ?? new Date(),
      confidence: input.confidence ?? "HIGH",
      verificationStatus: input.verificationStatus ?? "SOURCE_CONFIRMED",
      evidenceGrade: input.evidenceGrade ?? "C",
      reviewStatus: input.reviewStatus ?? "PENDING_REVIEW",
      createdBy: input.createdBy,
      note: input.note,
    },
    update: {},
  });
  return { ok: true, violations: [], id: created.id };
}