// Institutional profile queries for the public-institutions stream.
//
// Reusable, batched queries for the Product/UI stream. UI-specific business
// logic stays out of ingestion code; these functions are the read side.
// Queries batch roles/organisations/relationships/evidence (no N+1 loops) and
// bound graph traversals.

import { db } from "@/lib/db";
import type { InstitutionalCategory, RoleType, Prisma } from "@prisma/client";
import { publicVisibleWhere } from "@/lib/verification";
import { institutionalCategoryLabel } from "@/lib/constants";
import { detectTransitions, transitionDirectionLabel, type TransitionRole } from "./revolvingDoor";

export interface CategoryFilter {
  category: InstitutionalCategory;
  /** Restrict to currently-valid assignments. */
  current?: boolean;
}

// ---------------------------------------------------------------- organisations by category

export async function organizationsByCategory(filter: CategoryFilter, limit = 100) {
  const rows = await db.organizationInstitutionalCategory.findMany({
    where: {
      category: filter.category,
      ...(filter.current ? { OR: [{ validTo: null }, { validTo: { gte: new Date() } }] } : {}),
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      entity: {
        select: { id: true, canonicalName: true, type: true, subtype: true, entityCategory: true, description: true },
      },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
  return rows.map((r) => ({
    category: r.category,
    categoryLabel: institutionalCategoryLabel(r.category, "fi"),
    evidenceGrade: r.evidenceGrade,
    validFrom: r.validFrom,
    validTo: r.validTo,
    sourceUrl: r.source?.sourceUrl ?? null,
    entity: r.entity,
  }));
}

// ---------------------------------------------------------------- persons by role

export interface PersonRoleFilter {
  roleType?: RoleType | null;
  current?: boolean;
  organizationEntityId?: string;
}

export async function personsByInstitutionalRole(filter: PersonRoleFilter, limit = 200) {
  const where: Prisma.PositionWhereInput = {
    ...(filter.roleType ? { roleType: filter.roleType } : {}),
    ...(filter.organizationEntityId ? { organizationEntityId: filter.organizationEntityId } : {}),
    ...(filter.current !== undefined ? { isCurrent: filter.current } : {}),
  };
  const positions = await db.position.findMany({
    where,
    take: limit,
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      personEntity: { select: { id: true, canonicalName: true } },
      organizationEntity: { select: { id: true, canonicalName: true, type: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
  return positions;
}

// ---------------------------------------------------------------- organisation leadership & governance

export async function organizationLeadership(orgId: string, limit = 100) {
  return db.position.findMany({
    where: { organizationEntityId: orgId },
    take: limit,
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      personEntity: { select: { id: true, canonicalName: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
}

const GOVERNANCE_ROLE_TYPES: RoleType[] = [
  "BOARD_CHAIR",
  "BOARD_VICE_CHAIR",
  "BOARD_MEMBER",
  "SUPERVISORY_BOARD",
  "ADVISORY_BOARD",
];

export async function organizationGovernance(orgId: string) {
  return db.position.findMany({
    where: { organizationEntityId: orgId, roleType: { in: GOVERNANCE_ROLE_TYPES } },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      personEntity: { select: { id: true, canonicalName: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
}

// ---------------------------------------------------------------- public appointments

export async function publicAppointments(personId: string, limit = 100) {
  return db.position.findMany({
    where: {
      personEntityId: personId,
      OR: [{ appointedByEntityId: { not: null } }, { appointmentMethod: { not: null } }],
    },
    take: limit,
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      organizationEntity: { select: { id: true, canonicalName: true, type: true } },
      appointedByEntity: { select: { id: true, canonicalName: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
}

// ---------------------------------------------------------------- government supervision

export interface SupervisionRow {
  ministryId: string;
  ministryName: string;
  agencyId: string;
  agencyName: string;
  relationshipType: string;
  sourceUrl: string | null;
  evidence: { id: string; source: { sourceUrl: string; sourceName: string } }[];
}

export async function governmentSupervision(limit = 200): Promise<SupervisionRow[]> {
  const rels = await db.relationship.findMany({
    where: { relationshipType: "SUPERVISES", ...publicVisibleWhere },
    take: limit,
    include: {
      sourceEntity: { select: { id: true, canonicalName: true } },
      targetEntity: { select: { id: true, canonicalName: true } },
      evidence: { include: { source: { select: { sourceUrl: true, sourceName: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rels.map((r) => ({
    ministryId: r.sourceEntityId,
    ministryName: r.sourceEntity.canonicalName,
    agencyId: r.targetEntityId,
    agencyName: r.targetEntity.canonicalName,
    relationshipType: r.relationshipType,
    sourceUrl: r.evidence[0]?.source?.sourceUrl ?? null,
    evidence: r.evidence.map((e) => ({
      id: e.id,
      source: { sourceUrl: e.source.sourceUrl, sourceName: e.source.sourceName },
    })),
  }));
}

// ---------------------------------------------------------------- domain role bundles

const orgWhereForCategories = (categories: InstitutionalCategory[]): Prisma.EntityWhereInput => ({
  institutionalCategories: { some: { category: { in: categories } } },
});

export async function rolesInOrganizations(
  categories: InstitutionalCategory[],
  opts: { current?: boolean; limit?: number } = {},
) {
  const orgs = await db.entity.findMany({
    where: orgWhereForCategories(categories),
    select: { id: true },
    take: 200,
  });
  const ids = orgs.map((o) => o.id);
  if (ids.length === 0) return [];
  return db.position.findMany({
    where: {
      organizationEntityId: { in: ids },
      ...(opts.current !== undefined ? { isCurrent: opts.current } : {}),
    },
    take: opts.limit ?? 200,
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      personEntity: { select: { id: true, canonicalName: true } },
      organizationEntity: { select: { id: true, canonicalName: true, type: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
  });
}

export const municipalRoles = (opts: { current?: boolean; limit?: number } = {}) =>
  rolesInOrganizations(["MUNICIPALITY"], opts);

export const wellbeingCountyRoles = (opts: { current?: boolean; limit?: number } = {}) =>
  rolesInOrganizations(["WELLBEING_SERVICES_COUNTY"], opts);

export const ngoFoundationRoles = (opts: { current?: boolean; limit?: number } = {}) =>
  rolesInOrganizations(["NGO", "FOUNDATION"], opts);

export const labourMarketRoles = (opts: { current?: boolean; limit?: number } = {}) =>
  rolesInOrganizations(
    [
      "EMPLOYER_ORGANIZATION",
      "TRADE_UNION",
      "PROFESSIONAL_ORGANIZATION",
      "LABOUR_MARKET_CENTRAL_ORGANIZATION",
    ],
    opts,
  );

export const formalBodyRoles = (opts: { current?: boolean; limit?: number } = {}) =>
  rolesInOrganizations(["WORKING_GROUP", "ADVISORY_BODY", "COMMISSION", "COUNCIL"], opts);

// ---------------------------------------------------------------- revolving door

export async function revolvingDoorTransitions(personId: string) {
  const positions = await db.position.findMany({
    where: { personEntityId: personId },
    include: {
      organizationEntity: { select: { canonicalName: true, type: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
    orderBy: { startDate: "asc" },
  });
  const roles: TransitionRole[] = positions.map((p) => ({
    roleType: p.roleType,
    role: p.role,
    organizationName: p.organizationEntity?.canonicalName ?? null,
    organizationEntityType: p.organizationEntity?.type ?? null,
    startDate: p.startDate,
    endDate: p.endDate,
    sourceName: p.source?.sourceName ?? null,
    sourceUrl: p.source?.sourceUrl ?? null,
    sourceId: p.sourceId,
  }));
  const transitions = detectTransitions(roles);
  return transitions.map((t) => ({
    ...t,
    directionLabel: transitionDirectionLabel(t.direction, "fi"),
  }));
}

// ---------------------------------------------------------------- funding & procurement

export async function publicFundingRelationships(orgId: string, limit = 100) {
  return db.financialFlow.findMany({
    where: {
      recipientEntityId: orgId,
      ...publicVisibleWhere,
    },
    take: limit,
    orderBy: { amount: "desc" },
    include: {
      payerEntity: { select: { id: true, canonicalName: true, type: true } },
      evidence: { include: { source: { select: { sourceUrl: true, sourceName: true } } } },
    },
  });
}

export async function procurementRelationships(orgId: string, limit = 100) {
  const [asAuthority, asSupplier] = await Promise.all([
    db.procurementContract.findMany({
      where: { contractingAuthorityEntityId: orgId },
      take: limit,
      include: {
        supplier: { select: { id: true, canonicalName: true, type: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
      orderBy: { awardDate: "desc" },
    }),
    db.procurementContract.findMany({
      where: { supplierEntityId: orgId },
      take: limit,
      include: {
        contractingAuthority: { select: { id: true, canonicalName: true, type: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
      orderBy: { awardDate: "desc" },
    }),
  ]);
  return { asAuthority, asSupplier };
}

// ---------------------------------------------------------------- evidence drilldown

export async function evidenceDrilldown(entityId: string, limit = 100) {
  const [relationshipEvidence, flowEvidence, positions] = await Promise.all([
    db.evidence.findMany({
      where: { relationship: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }] } },
      take: limit,
      include: {
        source: { select: { sourceUrl: true, sourceName: true, sourceType: true } },
        relationship: { select: { relationshipType: true, sourceEntity: { select: { canonicalName: true } }, targetEntity: { select: { canonicalName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.evidence.findMany({
      where: { flow: { OR: [{ payerEntityId: entityId }, { recipientEntityId: entityId }] } },
      take: limit,
      include: {
        source: { select: { sourceUrl: true, sourceName: true, sourceType: true } },
        flow: { select: { amount: true, currency: true, flowType: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.position.findMany({
      where: { personEntityId: entityId },
      take: limit,
      select: {
        id: true,
        role: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        organizationEntity: { select: { canonicalName: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);
  return { relationshipEvidence, flowEvidence, positions };
}

// ---------------------------------------------------------------- batched profile

export async function institutionalProfile(entityId: string) {
  const entity = await db.entity.findUnique({
    where: { id: entityId },
    include: { aliases: true, externalIds: true, institutionalCategories: { include: { source: { select: { sourceUrl: true } } } } },
  });
  if (!entity) return null;
  const isPerson = entity.type === "PERSON";
  const [positions, relationships, governance, appointments, supervision, transitions] = await Promise.all([
    isPerson
      ? db.position.findMany({ where: { personEntityId: entityId }, include: { organizationEntity: { select: { id: true, canonicalName: true, type: true } }, source: { select: { sourceUrl: true } } }, orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] })
      : db.position.findMany({ where: { organizationEntityId: entityId }, include: { personEntity: { select: { id: true, canonicalName: true } }, source: { select: { sourceUrl: true } } }, orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] }),
    db.relationship.findMany({
      where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }], ...publicVisibleWhere },
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { include: { source: { select: { sourceUrl: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    isPerson ? [] : organizationGovernance(entityId),
    isPerson ? publicAppointments(entityId) : [],
    isPerson ? [] : governmentSupervision().then((s) => s.filter((r) => r.ministryId === entityId || r.agencyId === entityId)),
    isPerson ? revolvingDoorTransitions(entityId) : Promise.resolve([]),
  ]);
  return { entity, positions, relationships, governance, appointments, supervision, transitions };
}