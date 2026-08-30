import { db } from "@/lib/db";
import type { EntityType, RelationshipType } from "@prisma/client";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------- entity lookups

export async function getEntityById(id: string) {
  return db.entity.findUnique({
    where: { id },
    include: { person: true, organization: true, aliases: true, externalIds: true },
  });
}

export async function resolveShortId(short: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Entity" WHERE id::text LIKE ${short + "%"} LIMIT 1`;
  return rows[0]?.id ?? null;
}

export async function resolveEntityBySlug(slug: string) {
  const m = slug.match(/-([0-9a-f]{8})$/);
  if (m) {
    const fullId = await resolveShortId(m[1]);
    if (fullId) {
      return db.entity.findUnique({
        where: { id: fullId },
        include: { person: true, organization: true, aliases: true, externalIds: true },
      });
    }
  }
  const byName = await db.entity.findFirst({
    where: { canonicalName: { equals: slug.replace(/-/g, " "), mode: "insensitive" } },
    include: { person: true, organization: true, aliases: true, externalIds: true },
  });
  return byName ?? null;
}

// ---------------------------------------------------------------- search

export interface SearchResultGroup {
  id: string;
  type: string;
  label: string;
  entityType: EntityType | null;
  canonicalName: string;
  subtitle: string;
  url: string;
  score: number;
  sourceCount: number;
}

export async function searchEntities(q: string, limit = 25): Promise<SearchResultGroup[]> {
  const term = q.trim();
  if (!term) return [];
  const where: Prisma.EntityWhereInput = {
    OR: [
      { canonicalName: { contains: term, mode: "insensitive" as const } },
      { aliases: { some: { name: { contains: term, mode: "insensitive" as const } } } },
      { description: { contains: term, mode: "insensitive" as const } },
    ],
  };
  const entities = await db.entity.findMany({
    where,
    take: limit,
    orderBy: [{ sourceCount: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      type: true,
      canonicalName: true,
      description: true,
      sourceCount: true,
      updatedAt: true,
      person: { select: { electoralDistrict: true, partyEntityId: true } },
      organization: { select: { headquarters: true } },
    },
  });
  return entities.map((e) => {
    const subtitle =
      e.person?.electoralDistrict ??
      e.organization?.headquarters ??
      (e.description ? e.description.slice(0, 90) : "");
    return {
      id: e.id,
      type: e.type,
      label: e.type,
      entityType: e.type,
      canonicalName: e.canonicalName,
      subtitle: subtitle ?? "",
      url: entityUrlFor(e.id, e.type, e.canonicalName),
      score: e.sourceCount ?? 0,
      sourceCount: e.sourceCount,
    };
  });
}

export async function searchMoney(q: string, limit = 5) {
  const term = q.trim();
  if (!term) return [];
  return db.financialFlow.findMany({
    where: {
      OR: [
        { payerEntity: { canonicalName: { contains: term, mode: "insensitive" } } },
        { recipientEntity: { canonicalName: { contains: term, mode: "insensitive" } } },
        { purpose: { contains: term, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { amount: "desc" },
    include: {
      payerEntity: { select: { id: true, canonicalName: true, type: true } },
      recipientEntity: { select: { id: true, canonicalName: true, type: true } },
    },
  });
}

// ---------------------------------------------------------------- profile

export async function getPersonProfile(entityId: string) {
  const [entity, relationships, flows, positions, events, sources] = await Promise.all([
    db.entity.findUnique({
      where: { id: entityId },
      include: { person: true, aliases: true, externalIds: true },
    }),
    db.relationship.findMany({
      where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }] },
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { include: { source: true } },
      },
      orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    db.financialFlow.findMany({
      where: { OR: [{ payerEntityId: entityId }, { recipientEntityId: entityId }] },
      include: {
        payerEntity: { select: { id: true, canonicalName: true, type: true } },
        recipientEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { include: { source: true } },
      },
      orderBy: { flowDate: "desc" },
    }),
    db.position.findMany({
      where: { personEntityId: entityId },
      include: { source: true, organizationEntity: { select: { id: true, canonicalName: true, type: true } } },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    }),
    db.event.findMany({
      where: { entityId },
      include: { source: true },
      orderBy: { eventDate: "desc" },
    }),
    db.evidence.findMany({
      where: { entityId },
      include: { source: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return { entity, relationships, flows, positions, events, sources };
}

// ---------------------------------------------------------------- graph

export interface GraphQueryOptions {
  depth?: number;
  relationshipTypes?: RelationshipType[];
  includeFlows?: boolean;
  maxNodes?: number;
}

export async function getEntityGraph(entityId: string, opts: GraphQueryOptions = {}) {
  const depth = opts.depth ?? 1;
  const maxNodes = opts.maxNodes ?? 200;
  const nodeIds = new Set<string>([entityId]);
  const edgeKeys = new Set<string>();
  type RelWithEntities = Prisma.RelationshipGetPayload<{
    include: {
      sourceEntity: { select: { id: true; canonicalName: true; type: true } };
      targetEntity: { select: { id: true; canonicalName: true; type: true } };
      evidence: { select: { id: true; source: { select: { sourceUrl: true; sourceName: true } } } };
    };
  }>;
  type FlowWithEntities = Prisma.FinancialFlowGetPayload<{
    include: {
      payerEntity: { select: { id: true; canonicalName: true; type: true } };
      recipientEntity: { select: { id: true; canonicalName: true; type: true } };
      evidence: { select: { id: true; source: { select: { sourceUrl: true; sourceName: true } } } };
    };
  }>;
  const rels: RelWithEntities[] = [];
  const flows: FlowWithEntities[] = [];

  let frontier = [entityId];
  for (let d = 0; d < depth && frontier.length > 0 && nodeIds.size < maxNodes; d++) {
    const next: string[] = [];
    const relWhere: Prisma.RelationshipWhereInput = {
      OR: [
        { sourceEntityId: { in: frontier } },
        { targetEntityId: { in: frontier } },
      ],
      ...(opts.relationshipTypes && opts.relationshipTypes.length
        ? { relationshipType: { in: opts.relationshipTypes } }
        : {}),
    };
    const batch = await db.relationship.findMany({
      where: relWhere,
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { select: { id: true, source: { select: { sourceUrl: true, sourceName: true } } } },
      },
      take: 400,
    });
    for (const r of batch) {
      const key = `${r.sourceEntityId}|${r.targetEntityId}|${r.relationshipType}|${r.role}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      rels.push(r);
      for (const nid of [r.sourceEntityId, r.targetEntityId]) {
        if (!nodeIds.has(nid) && nodeIds.size < maxNodes) {
          nodeIds.add(nid);
          next.push(nid);
        }
      }
    }
    if (opts.includeFlows) {
      const flowBatch = await db.financialFlow.findMany({
        where: {
          OR: [{ payerEntityId: { in: frontier } }, { recipientEntityId: { in: frontier } }],
        },
        include: {
          payerEntity: { select: { id: true, canonicalName: true, type: true } },
          recipientEntity: { select: { id: true, canonicalName: true, type: true } },
          evidence: { select: { id: true, source: { select: { sourceUrl: true, sourceName: true } } } },
        },
        take: 200,
      });
      for (const f of flowBatch) {
        const key = `flow|${f.payerEntityId}|${f.recipientEntityId}|${f.id}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        flows.push(f);
        for (const nid of [f.payerEntityId, f.recipientEntityId]) {
          if (!nodeIds.has(nid) && nodeIds.size < maxNodes) {
            nodeIds.add(nid);
            next.push(nid);
          }
        }
      }
    }
    frontier = next;
  }

  const nodeRows = await db.entity.findMany({
    where: { id: { in: [...nodeIds] } },
    select: { id: true, canonicalName: true, type: true, subtype: true, sourceCount: true, person: { select: { partyEntityId: true } } },
  });
  return { nodes: nodeRows, relationships: rels, flows };
}

// ---------------------------------------------------------------- explore / aggregates

export async function getTopConnected(limit = 12) {
  return db.$queryRaw`
    SELECT e.id, e."canonicalName", e.type, COUNT(r.id)::int AS degree
    FROM "Entity" e
    LEFT JOIN "Relationship" r ON r."sourceEntityId" = e.id OR r."targetEntityId" = e.id
    GROUP BY e.id
    ORDER BY degree DESC
    LIMIT ${limit};
  ` as Promise<{ id: string; canonicalName: string; type: string; degree: number }[]>;
}

export async function getMoneyAggregates() {
  const byType = await db.financialFlow.groupBy({
    by: ["flowType"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });
  const byRecipient = await db.financialFlow.groupBy({
    by: ["recipientEntityId"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });
  const recipients = byRecipient.length
    ? await db.entity.findMany({
        where: { id: { in: byRecipient.map((r) => r.recipientEntityId) } },
        select: { id: true, canonicalName: true, type: true },
      })
    : [];
  return { byType, byRecipient, recipients };
}

export async function getRecentChanges(limit = 30) {
  return db.changeLog.findMany({
    take: limit,
    orderBy: { occurredAt: "desc" },
    include: {
      entity: { select: { id: true, canonicalName: true, type: true } },
      relationship: { select: { relationshipType: true } },
    },
  });
}

export async function getPartySizes() {
  const rows = await db.person.groupBy({
    by: ["partyEntityId"],
    _count: { _all: true },
  });
  return rows
    .filter((p) => p.partyEntityId)
    .sort((a, b) => ((b._count as { _all: number })._all ?? 0) - ((a._count as { _all: number })._all ?? 0));
}

export async function getCommitteeSizes(limit = 10) {
  return db.$queryRaw`
    SELECT e.id, e."canonicalName", COUNT(r.id)::int AS members
    FROM "Entity" e
    JOIN "Relationship" r ON r."targetEntityId" = e.id
    WHERE e.subtype = 'parliament_committee'
    GROUP BY e.id
    ORDER BY members DESC
    LIMIT ${limit};
  ` as Promise<{ id: string; canonicalName: string; members: number }[]>;
}

export async function getSources(limit = 200) {
  return db.source.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { evidence: true } } },
  });
}

export async function getLatestAgentRuns(limit = 10) {
  return db.agentRun.findMany({
    take: limit,
    orderBy: { startedAt: "desc" },
    include: { source: { select: { sourceName: true } } },
  });
}

// ---------------------------------------------------------------- url helper

export function entityUrlFor(id: string, type: EntityType, name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "entity";
  const prefix =
    type === "PERSON"
      ? "/person"
      : type === "COMPANY"
        ? "/company"
        : type === "POLITICAL_PARTY" ||
            type === "GOVERNMENT_BODY" ||
            type === "PUBLIC_AUTHORITY" ||
            type === "MEDIA_ORGANIZATION" ||
            type === "EDUCATIONAL_INSTITUTION" ||
            type === "COURT" ||
            type === "PENSION_INSTITUTION"
          ? "/institution"
          : "/organization";
  return `${prefix}/${slug}-${id.slice(0, 8)}`;
}