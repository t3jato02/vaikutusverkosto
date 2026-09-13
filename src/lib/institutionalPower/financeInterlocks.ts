// Board interlock queries — finance, capital & board networks (stream: finance).
//
// These queries detect STRUCTURAL board connections between the finance
// institutions and the wider graph, using only DOCUMENTED role assignments
// (Position) and their sources:
//
//   1. person on a bank board  +  a Nasdaq-listed company board
//   2. person on a pension-institution board  +  a state(-owned) company board
//   3. former politician (historical MP/MINISTER role)  +  current finance role
//   4. public official  +  supervisory/board role in a finance institution
//
// Every result row carries the underlying role sources (Position → Source), so
// no interlock is ever presented without its evidence. An interlock is a
// structural fact — never a collusion or corruption label. Only
// SOURCE_CONFIRMED / HUMAN_VERIFIED positions are shown.

import type { PrismaClient, RoleType, FinanceInstitutionType } from "@prisma/client";
import { isBoardRole } from "./interlock";

export const BANK_TYPES: FinanceInstitutionType[] = ["BANK", "CREDIT_INSTITUTION", "SAVINGS_BANK", "COOPERATIVE_BANK"];
export const PENSION_TYPES: FinanceInstitutionType[] = ["PENSION_INSURER", "PUBLIC_PENSION_INSTITUTION"];
export const POLITICIAN_ROLE_TYPES: RoleType[] = ["MP", "MINISTER"];
export const SUPERVISORY_ROLE_TYPES: RoleType[] = ["BOARD_MEMBER", "BOARD_CHAIR", "BOARD_VICE_CHAIR", "SUPERVISORY_BOARD", "TRUSTEE"];
export const PUBLIC_ENTITY_TYPES = ["GOVERNMENT_BODY", "PUBLIC_AUTHORITY", "PENSION_INSTITUTION", "EDUCATIONAL_INSTITUTION", "COURT"];
export const STATE_CATEGORIES = ["STATE_OWNED_COMPANY", "GOVERNMENT", "GOVERNMENT_AGENCY"];

export interface RoleView {
  organizationEntityId: string;
  organizationName: string;
  organizationType: string | null;
  organizationCategory: string | null;
  role: string;
  roleType: RoleType | null;
  isCurrent: boolean;
  sourceUrl: string | null;
  sourceName: string | null;
  /** Finance institution types of the organisation, when classified. */
  financeTypes: FinanceInstitutionType[];
  /** Nasdaq Helsinki ticker when the organisation is a listed issuer. */
  nasdaqSymbols: string[];
}

export interface InterlockRow {
  personEntityId: string;
  personName: string;
  /** Roles on the primary (finance) side of the interlock. */
  financeRoles: RoleView[];
  /** Roles on the paired side (listed company / state company / politician / public post). */
  pairedRoles: RoleView[];
  /** Distinct source URLs backing every role shown. */
  sources: string[];
}

export interface LoadedRole {
  personEntityId: string;
  personName: string;
  role: string;
  roleType: RoleType | null;
  isCurrent: boolean;
  organizationEntityId: string | null;
  organizationName: string | null;
  organizationType: string | null;
  organizationCategory: string | null;
  financeTypes: FinanceInstitutionType[];
  nasdaqSymbols: string[];
  sourceUrl: string | null;
  sourceName: string | null;
}

const CONFIRMED: { in: Array<"SOURCE_CONFIRMED" | "HUMAN_VERIFIED"> } = { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] };

/** Load all documented positions with their organisation classification and source. */
export async function loadFinancePositions(db: PrismaClient): Promise<LoadedRole[]> {
  const rows = await db.position.findMany({
    where: { verificationStatus: CONFIRMED },
    select: {
      personEntityId: true,
      role: true,
      roleType: true,
      isCurrent: true,
      personEntity: { select: { canonicalName: true } },
      organizationEntityId: true,
      organizationEntity: {
        select: {
          canonicalName: true,
          type: true,
          entityCategory: true,
          financeProfiles: { select: { institutionType: true } },
          externalIds: { where: { provider: "nasdaq-issuer" }, select: { identifier: true } },
        },
      },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });

  return rows.map((r) => ({
    personEntityId: r.personEntityId,
    personName: r.personEntity.canonicalName,
    role: r.role,
    roleType: r.roleType,
    isCurrent: r.isCurrent,
    organizationEntityId: r.organizationEntityId,
    organizationName: r.organizationEntity?.canonicalName ?? null,
    organizationType: r.organizationEntity?.type ?? null,
    organizationCategory: r.organizationEntity?.entityCategory ?? null,
    financeTypes: (r.organizationEntity?.financeProfiles ?? []).map((f) => f.institutionType),
    nasdaqSymbols: (r.organizationEntity?.externalIds ?? []).map((e) => e.identifier),
    sourceUrl: r.source?.sourceUrl ?? null,
    sourceName: r.source?.sourceName ?? null,
  }));
}

function toRoleView(r: LoadedRole): RoleView {
  return {
    organizationEntityId: r.organizationEntityId ?? "",
    organizationName: r.organizationName ?? "Tuntematon organisaatio",
    organizationType: r.organizationType,
    organizationCategory: r.organizationCategory,
    role: r.role,
    roleType: r.roleType,
    isCurrent: r.isCurrent,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    financeTypes: r.financeTypes,
    nasdaqSymbols: r.nasdaqSymbols,
  };
}

function groupRows(rows: LoadedRole[]): InterlockRow[] {
  const byPerson = new Map<string, { person: string; finance: LoadedRole[]; paired: LoadedRole[] }>();
  const order: string[] = [];
  for (const r of rows) {
    if (!byPerson.has(r.personEntityId)) {
      byPerson.set(r.personEntityId, { person: r.personName, finance: [], paired: [] });
      order.push(r.personEntityId);
    }
    // Finance side = a role IN a classified finance institution.
    if (r.financeTypes.length > 0) byPerson.get(r.personEntityId)!.finance.push(r);
    else byPerson.get(r.personEntityId)!.paired.push(r);
  }

  const out: InterlockRow[] = [];
  for (const id of order) {
    const g = byPerson.get(id)!;
    out.push({
      personEntityId: id,
      personName: g.person,
      financeRoles: g.finance.map(toRoleView),
      pairedRoles: g.paired.map(toRoleView),
      sources: [...new Set<string>([...g.finance, ...g.paired].flatMap((r) => (r.sourceUrl ? [r.sourceUrl] : []) as string[]))],
    });
  }
  return out;
}

function matchPredicate(groups: InterlockRow[], financeTypes: FinanceInstitutionType[], paired: (r: RoleView) => boolean): InterlockRow[] {
  return groups.filter((g) => {
    const fin = g.financeRoles.filter((r) => r.isCurrent && isBoardRole(r.roleType) && r.financeTypes.some((t) => financeTypes.includes(t)));
    if (fin.length === 0) return false;
    const pair = g.pairedRoles.filter((r) => r.isCurrent && paired(r));
    if (pair.length === 0) return false;
    return true;
  });
}

/** Person on a bank board + a Nasdaq-listed company board. */
export function bankBoardAndListedCompanyInterlocks(rows: LoadedRole[]): InterlockRow[] {
  return matchPredicate(
    groupRows(rows),
    BANK_TYPES,
    (r) => isBoardRole(r.roleType) && r.nasdaqSymbols.length > 0,
  );
}

/** Person on a pension-institution board + a state(-owned) company board. */
export function pensionBoardAndStateCompanyInterlocks(rows: LoadedRole[]): InterlockRow[] {
  return matchPredicate(
    groupRows(rows),
    PENSION_TYPES,
    (r) => isBoardRole(r.roleType) && STATE_CATEGORIES.includes(r.organizationCategory ?? ""),
  );
}

/** Person with a historical MP/MINISTER role + a current finance role. */
export function formerPoliticianFinanceRoles(rows: LoadedRole[]): InterlockRow[] {
  const groups = groupRows(rows);
  return groups.filter((g) => {
    const wasPolitician = g.pairedRoles.some(
      (r) => !r.isCurrent && r.roleType && POLITICIAN_ROLE_TYPES.includes(r.roleType),
    );
    if (!wasPolitician) return false;
    const currentFinance = g.financeRoles.some((r) => r.isCurrent);
    return currentFinance;
  });
}

/** Person with a current public post + a current board/supervisory role in a finance institution. */
export function publicOfficialSupervisoryRoles(rows: LoadedRole[]): InterlockRow[] {
  const groups = groupRows(rows);
  return groups.filter((g) => {
    const publicPost = g.pairedRoles.some(
      (r) => r.isCurrent && PUBLIC_ENTITY_TYPES.includes(r.organizationType ?? ""),
    );
    if (!publicPost) return false;
    const supervisory = g.financeRoles.some(
      (r) => r.isCurrent && r.roleType && SUPERVISORY_ROLE_TYPES.includes(r.roleType),
    );
    return supervisory;
  });
}

export interface FinanceInterlockReport {
  generatedAt: string;
  queries: {
    bankBoardAndListedCompany: InterlockRow[];
    pensionBoardAndStateCompany: InterlockRow[];
    formerPoliticianFinance: InterlockRow[];
    publicOfficialSupervisory: InterlockRow[];
  };
}

export async function financeInterlockReport(db: PrismaClient): Promise<FinanceInterlockReport> {
  const rows = await loadFinancePositions(db);
  return {
    generatedAt: new Date().toISOString(),
    queries: {
      bankBoardAndListedCompany: bankBoardAndListedCompanyInterlocks(rows),
      pensionBoardAndStateCompany: pensionBoardAndStateCompanyInterlocks(rows),
      formerPoliticianFinance: formerPoliticianFinanceRoles(rows),
      publicOfficialSupervisory: publicOfficialSupervisoryRoles(rows),
    },
  };
}