// Shared types for the curated finance data manifest (finance stream).
//
// Every record is backed by a real public source (see per-record `evidenceUrl`).
// The manifest is deterministic and idempotent: re-ingesting the same manifest
// is a no-op (collector change-detection + upserts). Facts were transcribed by
// a human from official governance pages / registers; nothing is AI-inferred.

import type {
  EntityType,
  EntityCategory,
  RoleType,
  Sector,
  Confidence,
  EvidenceGrade,
  FinanceInstitutionType,
  ScaleMetricType,
} from "@prisma/client";

/** A year-bound institutional scale figure from the org's own reporting. */
export interface ManifestScale {
  metric: ScaleMetricType;
  /** Full EUR value (never an estimate; never used for personal wealth). */
  value: number;
  currency: string;
  year: number;
  note?: string;
  sourceUrl: string;
  sourceName: string;
  evidenceGrade: EvidenceGrade;
}

/** A stable organisation reference used across manifest sections. */
export interface ManifestOrg {
  /** Stable slug used as the default external id (`fi-finance:<id>`). */
  id: string;
  name: string;
  type: EntityType;
  /** One or more finance-institution kinds (e.g. BANK + FINANCIAL_GROUP). */
  financeTypes: FinanceInstitutionType[];
  /** Existing EntityCategory assigned at entity creation. */
  entityCategory?: EntityCategory;
  aliases?: string[];
  description?: string;
  subtype?: string;
  municipality?: string;
  officialUrl?: string;
  /** Strong external identity; defaults to `fi-finance:<id>`. */
  externalId?: { provider: string; identifier: string };
  /** Y-tunnus — deterministic resolution against PRH / other streams. */
  businessId?: string;
  /** GLEIF Legal Entity Identifier (also mapped as `gleif-lei`). */
  lei?: string;
  /** SWIFT/BIC code (also mapped as `swift-bic`). */
  bic?: string;
  /** FIN-FSA register id, when the institution is supervised. */
  finFsaRegistrationId?: string;
  /** Nasdaq Helsinki ticker — marks the entity as a listed issuer (`nasdaq-issuer`). */
  nasdaqSymbol?: string;
  /** Documented parent organisation (GLEIF-verified where available). */
  parent?: { name: string; lei?: string; type?: EntityType; countryCode?: string; sourceUrl: string };
  /** FIN-FSA supervises this institution → a SUPERVISES edge to FIN-FSA. */
  supervisedByFinFsa?: boolean;
  sectors: Sector[];
  scaleStatements?: ManifestScale[];
  /** Publicly documented ownership description (never inferred). */
  ownershipNote?: { description: string; sourceUrl: string };
  /** Where the organisation's existence + classification is documented. */
  evidenceUrl: string;
  sourceName: string;
  evidenceGrade: EvidenceGrade;
}

/** A documented person→organisation role (a RoleAssignment). */
export interface ManifestRole {
  person: string;
  /** Strong person identity when known (reuses existing canonical persons). */
  personExternalId?: { provider: string; identifier: string };
  /** Org slug (`ManifestOrg.id`). */
  org: string;
  /** Free-text role title in Finnish, as documented. */
  role: string;
  roleType: RoleType;
  department?: string;
  /** ISO dates YYYY-MM-DD. Unknown dates are simply absent. */
  startDate?: string;
  endDate?: string;
  /** Source explicitly asserts this is an active, present-day role. */
  current?: boolean;
  appointmentMethod?: "NOMINATION" | "ELECTION" | "APPOINTMENT" | "OWNER_DECISION" | "SECONDMENT" | "OTHER";
  /** Org slug of the appointing body, when it is itself in the manifest. */
  appointedBy?: string;
  /** Literal name of an appointing body not in the manifest. */
  appointedByName?: string;
  evidenceUrl: string;
  sourceName: string;
  evidenceGrade: EvidenceGrade;
  confidence?: Confidence;
}

export interface ManifestSection {
  id: string;
  url: string;
  title: string;
  orgs: ManifestOrg[];
  roles: ManifestRole[];
}