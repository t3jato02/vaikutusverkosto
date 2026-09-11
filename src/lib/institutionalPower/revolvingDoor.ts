// Revolving-door timeline (institutional-power foundation, section 9).
//
// Source-backed transition detection: a person's documented roles are ordered
// by time and consecutive roles whose sphere differs produce a "Roolisiirtymä"
// (role transition). Examples: minister → company board, civil servant →
// industry association, industry executive → regulator, MP → state-company
// board.
//
// The detection is NEUTRAL. A transition is a dated, sourced structural fact —
// never labelled problematic, suspicious or improper.

import type { RoleType, EntityType } from "@prisma/client";

export type Sphere = "public" | "corporate" | "ngo" | "media" | "academia" | "other";

export interface TransitionRole {
  roleType?: RoleType | null;
  role?: string | null;
  organizationName?: string | null;
  organizationEntityType?: EntityType | null;
  /** Explicit sphere override (e.g. a documented regulator). */
  sphere?: Sphere | null;
  startDate?: Date | null;
  endDate?: Date | null;
  sourceId?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

export interface RoleTransition {
  from: TransitionRole;
  to: TransitionRole;
  direction: string; // "public_to_corporate" | "corporate_to_public" | "public_to_ngo" | ...
  /** Days between from.endDate and to.startDate (null when dates are unknown). */
  gapDays: number | null;
  sourceNames: string[];
}

const PUBLIC_ROLE_TYPES = new Set<RoleType | string>([
  "MP",
  "MINISTER",
  "MUNICIPAL_POLITICIAN",
  "CIVIL_SERVANT",
  "REGULATOR",
  "DIRECTOR_GENERAL",
  "SECRETARY_GENERAL",
  "PRESIDENT",
  "CHAIR",
  "POLITICAL_APPOINTEE",
  "COMMITTEE_MEMBER",
  "SECTOR_COUNCIL",
  "PUBLIC_AGENCY_EXECUTIVE",
]);

const PUBLIC_ENTITY_TYPES = new Set<EntityType>([
  "GOVERNMENT_BODY",
  "PUBLIC_AUTHORITY",
  "COURT",
  "EDUCATIONAL_INSTITUTION",
  "PENSION_INSTITUTION",
]);

const NGO_ENTITY_TYPES = new Set<EntityType>(["ASSOCIATION", "FOUNDATION", "UNION"]);
const MEDIA_ENTITY_TYPES = new Set<EntityType>(["MEDIA_ORGANIZATION"]);
const ACADEMIA_ENTITY_TYPES = new Set<EntityType>(["EDUCATIONAL_INSTITUTION"]);

/** Documented sphere of a role. Explicit override wins; else role type, then org type. */
export function sphereOf(role: TransitionRole): Sphere {
  if (role.sphere) return role.sphere;
  if (role.roleType && PUBLIC_ROLE_TYPES.has(role.roleType)) return "public";
  const t = role.organizationEntityType;
  if (t) {
    if (PUBLIC_ENTITY_TYPES.has(t)) return t === "EDUCATIONAL_INSTITUTION" ? "academia" : "public";
    if (NGO_ENTITY_TYPES.has(t)) return "ngo";
    if (MEDIA_ENTITY_TYPES.has(t)) return "media";
    if (ACADEMIA_ENTITY_TYPES.has(t)) return "academia";
    if (t === "COMPANY") return "corporate";
  }
  return "other";
}

function directionOf(from: Sphere, to: Sphere): string {
  if (from === to) return `${from}_to_${from}`;
  return `${from}_to_${to}`;
}

/** Chronological start of a role (startDate, else endDate, else null). */
function roleTime(r: TransitionRole): number | null {
  const d = r.startDate ?? r.endDate;
  return d ? d.getTime() : null;
}

/**
 * Detect source-backed role transitions for a person. Roles are ordered by
 * start date; consecutive roles whose sphere differs produce a transition.
 * Overlapping roles are ordered by their earliest start; simultaneous roles are
 * NOT treated as transitions (a transition requires a sequential change).
 */
export function detectTransitions(roles: TransitionRole[]): RoleTransition[] {
  const ordered = [...roles].sort((a, b) => {
    const ta = roleTime(a) ?? Number.MAX_SAFE_INTEGER;
    const tb = roleTime(b) ?? Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  const transitions: RoleTransition[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1];
    const to = ordered[i];
    const sf = sphereOf(from);
    const st = sphereOf(to);
    if (sf === st) continue;
    // A transition is a SEQUENTIAL change: the FROM role must have demonstrably
    // ended before the TO role began. If the FROM role is open-ended (still
    // current) or the periods overlap, the roles are simultaneous — that is a
    // dual role, not a transition, and must never be labelled one.
    const fromEnded = from.endDate !== null && from.endDate !== undefined;
    const toStarted = to.startDate !== null && to.startDate !== undefined;
    if (!fromEnded) continue;
    if (toStarted && to.startDate! < from.endDate!) continue;
    const gapDays =
      from.endDate && to.startDate
        ? Math.round((to.startDate.getTime() - from.endDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    transitions.push({
      from,
      to,
      direction: directionOf(sf, st),
      gapDays,
      sourceNames: [from.sourceName, to.sourceName].filter(Boolean) as string[],
    });
  }
  return transitions;
}

/** The canonical neutral label for a transition direction (fi). */
export function transitionDirectionLabel(direction: string, locale: "fi" | "en" = "fi"): string {
  const map: Record<string, string> = {
    public_to_corporate: locale === "fi" ? "Julkisesta tehtävästä yritystehtävään" : "Public to corporate",
    corporate_to_public: locale === "fi" ? "Yritystehtävästä julkiseen tehtävään" : "Corporate to public",
    public_to_ngo: locale === "fi" ? "Julkisesta tehtävästä järjestötehtävään" : "Public to organisation",
    ngo_to_public: locale === "fi" ? "Järjestötehtävästä julkiseen tehtävään" : "Organisation to public",
    corporate_to_ngo: locale === "fi" ? "Yritystehtävästä järjestötehtävään" : "Corporate to organisation",
    ngo_to_corporate: locale === "fi" ? "Järjestötehtävästä yritystehtävään" : "Organisation to corporate",
    public_to_media: locale === "fi" ? "Julkisesta tehtävästä mediatehtävään" : "Public to media",
    media_to_public: locale === "fi" ? "Mediatehtävästä julkiseen tehtävään" : "Media to public",
    public_to_academia: locale === "fi" ? "Julkisesta tehtävästä akateemiseen tehtävään" : "Public to academia",
    academia_to_public: locale === "fi" ? "Akateemisesta tehtävästä julkiseen tehtävään" : "Academia to public",
    corporate_to_media: locale === "fi" ? "Yritystehtävästä mediatehtävään" : "Corporate to media",
    media_to_corporate: locale === "fi" ? "Mediatehtävästä yritystehtävään" : "Media to corporate",
  };
  return map[direction] ?? direction.replace(/_/g, " ");
}