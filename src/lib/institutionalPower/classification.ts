// Person classification layer (institutional-power foundation, section 2).
//
// A person holds MULTIPLE simultaneous classifications — former minister +
// company board chair + foundation trustee. Classifications are NEVER stored as
// a mutually-exclusive category: they are DERIVED deterministically from
// source-backed facts (RoleAssignment rows on Position + documented
// relationships). This guarantees a classification can never drift from its
// evidence, and a role that ended can never present as current.
//
// Classification keys are stable machine strings; where the key equals a
// RoleType value, label it through ROLE_TYPE_LABELS in constants.ts.

import type { RoleType, RelationshipType, EntityType, Sector } from "@prisma/client";
import { ROLE_TYPE_LABELS, roleTypeLabel } from "@/lib/constants";

export type ClassificationBasis = "role" | "relationship" | "employment";

export interface DerivedClassification {
  /** Stable machine key (a RoleType value, or a relationship-derived key). */
  key: string;
  /** Human label (fi). Never a raw enum. */
  label: string;
  basis: ClassificationBasis;
  /** True when the underlying fact is a current, open-ended role. */
  isCurrent: boolean;
  temporalState: "CURRENT" | "HISTORICAL";
}

export interface ClassificationInputPosition {
  roleType: RoleType | null;
  role?: string | null;
  isCurrent: boolean;
  organizationEntityType?: EntityType | null;
  organizationSectors?: Array<Sector | string> | null;
}

export interface ClassificationInputRelationship {
  type: RelationshipType;
  isCurrent: boolean;
  targetEntityType?: EntityType | null;
}

export interface ClassificationInput {
  positions: ClassificationInputPosition[];
  relationships?: ClassificationInputRelationship[];
}

/** Documented board-relationship keys, never inferred from name or title. */
const BOARD_RELATIONSHIP_KEYS: Partial<Record<RelationshipType, string>> = {
  BOARD_MEMBER_OF: "BOARD_MEMBER",
  CHAIRS: "BOARD_CHAIR",
};

/**
 * Documented employment-sector → person classification. Only when the person
 * currently works for an organisation whose sector is itself documented.
 * Basis "employment"; never a value judgment.
 */
const EMPLOYMENT_SECTOR_KEYS: Partial<Record<string, string>> = {
  BANKING: "BANKER",
  INVESTMENT: "INVESTOR",
};

/** Derive a person's full set of documented classifications (no mutual exclusion). */
export function derivePersonClassifications(input: ClassificationInput): DerivedClassification[] {
  const out = new Map<string, DerivedClassification>();

  const add = (c: DerivedClassification) => {
    // A current fact always wins over a historical one with the same key.
    const existing = out.get(c.key);
    if (!existing || (existing.temporalState === "HISTORICAL" && c.temporalState === "CURRENT")) {
      out.set(c.key, c);
    }
  };

  for (const p of input.positions) {
    if (p.roleType) {
      add({
        key: p.roleType,
        label: roleTypeLabel(p.roleType, "fi"),
        basis: "role",
        isCurrent: p.isCurrent,
        temporalState: p.isCurrent ? "CURRENT" : "HISTORICAL",
      });
    }
  }

  for (const r of input.relationships ?? []) {
    const key = BOARD_RELATIONSHIP_KEYS[r.type];
    if (key) {
      add({
        key,
        label: ROLE_TYPE_LABELS[key as RoleType]?.fi ?? key.toLowerCase(),
        basis: "relationship",
        isCurrent: r.isCurrent,
        temporalState: r.isCurrent ? "CURRENT" : "HISTORICAL",
      });
    }
  }

  return [...out.values()];
}

/**
 * Employment-sector classification from a documented current employment.
 * `sectors` must be the *documented* sectors of the employer organisation.
 * Returns null unless a sector maps to a classification.
 */
export function employmentClassification(
  employerSectors: Array<Sector | string> | null | undefined,
): DerivedClassification | null {
  if (!employerSectors) return null;
  for (const s of employerSectors) {
    const key = EMPLOYMENT_SECTOR_KEYS[String(s)];
    if (key) {
      return {
        key,
        label: ROLE_TYPE_LABELS[key as RoleType]?.fi ?? key.toLowerCase(),
        basis: "employment",
        isCurrent: true,
        temporalState: "CURRENT",
      };
    }
  }
  return null;
}

/** Current classifications only — what a person "is" today, per the evidence. */
export function currentClassifications(input: ClassificationInput): DerivedClassification[] {
  return derivePersonClassifications(input).filter((c) => c.isCurrent);
}

/** True when at least one classification is backed by a current fact. */
export function hasDocumentedClassification(input: ClassificationInput): boolean {
  return derivePersonClassifications(input).length > 0;
}