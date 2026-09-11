// Identity framing — UI labels (public UI must never render raw enums).
// Mirrors the pattern of src/lib/journalism.ts.

import type { MediaIdentityTermCategory, IdentityReviewStatus, CitizenshipStatus, OriginFactKind } from "@prisma/client";

type Label = { fi: string; en: string; description?: string };

export const IDENTITY_TERM_CATEGORY_LABELS: Record<MediaIdentityTermCategory, Label> = {
  NATIONALITY: { fi: "Kansallisuusnimitys", en: "Nationality label", description: "Etnonyymi kuten 'suomalainen' tai 'nepalilainen'." },
  CITIZENSHIP: { fi: "Kansalaisuus (juridinen)", en: "Citizenship", description: "Juridinen kansalaisuus kuten 'Suomen kansalainen'." },
  RESIDENCE: { fi: "Asuinpaikka", en: "Residence", description: "Asumiseen viittaava ilmaus kuten 'Suomessa asuva'." },
  PLACE_OF_BIRTH: { fi: "Syntymäpaikka", en: "Place of birth", description: "Syntymäpaikkaan viittaava ilmaus kuten 'Suomessa syntynyt'." },
  IMMIGRATION_STATUS: { fi: "Maahanmuuttostatus", en: "Immigration status", description: "Statusilmaus kuten 'maahanmuuttaja' tai 'ulkomaalaistaustainen'." },
  CITY_IDENTITY: { fi: "Paikallisuus (kaupunki)", en: "City identity", description: "Kaupunki-identiteetti kuten 'helsinkiläinen'." },
  REGION_IDENTITY: { fi: "Paikallisuus (alue)", en: "Region identity", description: "Alue-identiteetti kuten 'pohjalainen'." },
  OTHER: { fi: "Muu", en: "Other", description: "Muu identiteetti-ilmaus." },
};

export function identityTermCategoryLabel(c: MediaIdentityTermCategory | string, lang: "fi" | "en" = "fi"): string {
  return IDENTITY_TERM_CATEGORY_LABELS[c as MediaIdentityTermCategory]?.[lang] ?? String(c);
}

export function identityTermCategoryDescription(c: MediaIdentityTermCategory | string): string {
  return IDENTITY_TERM_CATEGORY_LABELS[c as MediaIdentityTermCategory]?.description ?? "";
}

export const IDENTITY_REVIEW_LABELS: Record<IdentityReviewStatus, Label> = {
  PENDING_REVIEW: { fi: "Odottaa tarkistusta", en: "Pending review" },
  PUBLISHED: { fi: "Julkaistu", en: "Published" },
  REJECTED: { fi: "Hylätty", en: "Rejected" },
  DISPUTED: { fi: "Riitautettu", en: "Disputed" },
};

export function identityReviewLabel(s: IdentityReviewStatus | string, lang: "fi" | "en" = "fi"): string {
  return IDENTITY_REVIEW_LABELS[s as IdentityReviewStatus]?.[lang] ?? String(s);
}

export const CITIZENSHIP_STATUS_LABELS: Record<CitizenshipStatus, Label> = {
  CURRENT: { fi: "Nykyinen kansalaisuus", en: "Current citizenship" },
  FORMER: { fi: "Aiempi kansalaisuus", en: "Former citizenship" },
  UNKNOWN: { fi: "Kansalaisuus ei tiedossa", en: "Citizenship unknown" },
};

export function citizenshipStatusLabel(s: CitizenshipStatus | string, lang: "fi" | "en" = "fi"): string {
  return CITIZENSHIP_STATUS_LABELS[s as CitizenshipStatus]?.[lang] ?? String(s);
}

export const ORIGIN_FACT_KIND_LABELS: Record<OriginFactKind, Label> = {
  BIRTH_COUNTRY: { fi: "Syntymämaa", en: "Country of birth" },
  BIRTH_PLACE: { fi: "Syntymäpaikka", en: "Place of birth" },
};

export function originFactKindLabel(k: OriginFactKind | string, lang: "fi" | "en" = "fi"): string {
  return ORIGIN_FACT_KIND_LABELS[k as OriginFactKind]?.[lang] ?? String(k);
}

/** A stable, neutral caption for the person profile "Syntymämaatausta" card. */
export const SYNTOMA_MAA_HEADING = "Syntymämaatausta";
export const SYNTOMA_MAA_DISCLAIMER =
  "Syntymämaa on muuttumaton historiallinen tieto. Kansalaisuus, asuinpaikka ja henkilön oma identiteetti ovat erillisiä asioita. Järjestelmä ei päättele tietoja nimestä tai ulkonäöstä.";