// Shared types for the curated public-institutions data manifest.
//
// Every record is backed by a real public source (see per-record `evidenceUrl`).
// The manifest is deterministic and idempotent: re-ingesting the same manifest
// is a no-op (collector change-detection + upserts). Nothing here is inferred
// from AI; a human transcribed each fact from the cited public page.

import type {
  EntityType,
  EntityCategory,
  RoleType,
  InstitutionalCategory,
  Confidence,
  EvidenceGrade,
} from "@prisma/client";

/** A stable organisation reference used across manifest sections. */
export interface ManifestOrg {
  /** Stable slug used as the default external id (`fi-institution:<id>`). */
  id: string;
  name: string;
  type: EntityType;
  category: InstitutionalCategory;
  /** Existing EntityCategory assigned at entity creation. */
  entityCategory?: EntityCategory;
  aliases?: string[];
  description?: string;
  subtype?: string;
  municipality?: string;
  region?: string;
  officialUrl?: string;
  /** Strong external identity; defaults to `fi-institution:<id>`. */
  externalId?: { provider: string; identifier: string };
  /** Y-tunnus for companies — deterministic resolution against PRH / Stream B. */
  businessId?: string;
  /** Slug of the supervising ministry/body → emits a ministry SUPERVISES edge. */
  supervisedBy?: string;
  /** Where the organisation's existence + category is documented. */
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