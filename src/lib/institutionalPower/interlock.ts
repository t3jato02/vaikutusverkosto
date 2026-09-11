// Board interlock engine (institutional-power foundation, section 8).
//
// Detects structural board connections from DOCUMENTED role assignments:
//   Person → Board Member → Company A
//   Person → Board Member → Company B
//   Person → Board Chair → Foundation C
//
// Interlock queries: people with most current board roles, cross-sector board
// links, public/private board overlap. Historical roles remain historical —
// they never count toward a current interlock figure. An interlock is a
// STRUCTURAL fact; it is never labelled as collusion, corruption or wrongdoing.

import type { RoleType, EntityType, Sector } from "@prisma/client";

export interface InterlockRole {
  personEntityId: string;
  personName?: string | null;
  organizationEntityId: string;
  organizationName?: string | null;
  roleType?: RoleType | null;
  role?: string | null;
  isCurrent: boolean;
  organizationEntityType?: EntityType | null;
  organizationSectors?: Array<Sector | string> | null;
  /** Documented public/private classification of the organisation (null = unknown). */
  organizationIsPublic?: boolean | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface InterlockResult {
  personEntityId: string;
  personName?: string | null;
  currentBoardCount: number;
  historicalBoardCount: number;
  boards: InterlockRole[];
  sectors: string[];
  /** True when current board roles span ≥ 2 distinct documented sectors. */
  crossSector: boolean;
  /** True when the person holds current board roles in BOTH public and private organisations. */
  publicPrivateOverlap: boolean;
  publicBoardCount: number;
  privateBoardCount: number;
  unknownSectorBoardCount: number;
}

const BOARD_ROLE_TYPES = new Set<RoleType | string>([
  "BOARD_CHAIR",
  "BOARD_VICE_CHAIR",
  "BOARD_MEMBER",
  "SUPERVISORY_BOARD",
  "ADVISORY_BOARD",
  "CHAIRS",
  "TRUSTEE",
]);

export function isBoardRole(roleType: RoleType | string | null | undefined): boolean {
  return Boolean(roleType && BOARD_ROLE_TYPES.has(roleType));
}

const PUBLIC_ENTITY_TYPES = new Set<EntityType>([
  "GOVERNMENT_BODY",
  "PUBLIC_AUTHORITY",
  "COURT",
  "EDUCATIONAL_INSTITUTION",
  "PENSION_INSTITUTION",
]);

/** Public/private classification from documented organisation type. */
export function isPublicOrganisation(role: Pick<InterlockRole, "organizationEntityType" | "organizationIsPublic">): boolean | null {
  if (role.organizationIsPublic !== null && role.organizationIsPublic !== undefined) return role.organizationIsPublic;
  if (role.organizationEntityType) return PUBLIC_ENTITY_TYPES.has(role.organizationEntityType);
  return null;
}

function buildResult(personEntityId: string, roles: InterlockRole[]): InterlockResult {
  const current = roles.filter((r) => r.isCurrent);
  const historical = roles.filter((r) => !r.isCurrent);
  const sectors = new Set<string>();
  for (const r of current) for (const s of r.organizationSectors ?? []) sectors.add(String(s));
  const publicCount = current.filter((r) => isPublicOrganisation(r) === true).length;
  const privateCount = current.filter((r) => isPublicOrganisation(r) === false).length;
  const unknownSectorBoardCount = current.filter((r) => !r.organizationSectors || r.organizationSectors.length === 0).length;

  return {
    personEntityId,
    personName: current.find((r) => r.personName)?.personName ?? historical.find((r) => r.personName)?.personName ?? null,
    currentBoardCount: current.length,
    historicalBoardCount: historical.length,
    boards: roles,
    sectors: [...sectors],
    crossSector: sectors.size >= 2,
    publicPrivateOverlap: publicCount > 0 && privateCount > 0,
    publicBoardCount: publicCount,
    privateBoardCount: privateCount,
    unknownSectorBoardCount,
  };
}

/** All board interlocks from a set of role assignments (only board roles). */
export function boardInterlocks(roles: InterlockRole[]): InterlockResult[] {
  const byPerson = new Map<string, InterlockRole[]>();
  for (const r of roles) {
    if (!isBoardRole(r.roleType)) continue;
    const list = byPerson.get(r.personEntityId) ?? [];
    list.push(r);
    byPerson.set(r.personEntityId, list);
  }
  return [...byPerson.entries()].map(([personEntityId, rs]) => buildResult(personEntityId, rs));
}

/** People with the most current board roles, descending. */
export function mostConnectedBoardMembers(roles: InterlockRole[], limit = 20): InterlockResult[] {
  return boardInterlocks(roles)
    .filter((r) => r.currentBoardCount > 0)
    .sort((a, b) => b.currentBoardCount - a.currentBoardCount)
    .slice(0, limit);
}

/** People whose current board roles span multiple distinct documented sectors. */
export function crossSectorInterlocks(roles: InterlockRole[]): InterlockResult[] {
  return boardInterlocks(roles).filter((r) => r.crossSector);
}

/** People holding current board roles in both public and private organisations. */
export function publicPrivateBoardOverlap(roles: InterlockRole[]): InterlockResult[] {
  return boardInterlocks(roles).filter((r) => r.publicPrivateOverlap);
}