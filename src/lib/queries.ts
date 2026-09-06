import { db } from "@/lib/db";
import type { EntityType, RelationshipType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { publicVisibleWhere } from "@/lib/verification";

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
  // Over-fetch, then rank in JS so a whole-word / prefix hit (e.g. "Orpo" →
  // "Petteri Orpo") beats an incidental mid-word substring ("...Corporation").
  const entities = await db.entity.findMany({
    where,
    take: Math.min(limit * 6, 150),
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
  const t = term.toLowerCase();
  const wordBoundary = new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu");
  const matchRank = (name: string): number => {
    const n = name.toLowerCase();
    if (n === t) return 0;
    if (n.startsWith(t)) return 1;
    if (wordBoundary.test(name)) return 2;
    return 3;
  };
  const ranked = entities
    .map((e) => ({ e, r: matchRank(e.canonicalName) }))
    .sort((a, b) => a.r - b.r || (b.e.sourceCount ?? 0) - (a.e.sourceCount ?? 0))
    .slice(0, limit);
  return ranked.map(({ e }) => {
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
      ...publicVisibleWhere,
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
      where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }], ...publicVisibleWhere },
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { include: { source: true } },
      },
      orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    db.financialFlow.findMany({
      where: { OR: [{ payerEntityId: entityId }, { recipientEntityId: entityId }], ...publicVisibleWhere },
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
      ...publicVisibleWhere,
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
          ...publicVisibleWhere,
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
    where: publicVisibleWhere,
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });
  const byRecipient = await db.financialFlow.groupBy({
    by: ["recipientEntityId"],
    where: publicVisibleWhere,
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

// Event types produced in high volume by a single ingestion run. Kept in sync
// with BULK_EVENT_TYPES in groupRecentChanges.
const BULK_CHANGE_TYPES = ["NEW_GRANT", "NEW_CONTRACT", "ENTITY_UPDATED"] as const;

export async function getRecentChanges(limit = 30) {
  const ent = { select: { id: true, canonicalName: true, type: true } } as const;
  const include = {
    entity: ent,
    relationship: {
      select: { relationshipType: true, sourceEntityId: true, sourceEntity: ent, targetEntity: ent },
    },
    flow: {
      select: { amount: true, currency: true, flowType: true, payerEntity: ent, recipientEntity: ent },
    },
  } as const;

  // Two windows so a large grant/contract import (which rolls up to a single
  // feed row) never buries every per-actor change behind it.
  const [narrative, bulk] = await Promise.all([
    db.changeLog.findMany({
      where: { eventType: { notIn: [...BULK_CHANGE_TYPES] } },
      take: Math.max(limit * 4, 120),
      orderBy: { occurredAt: "desc" },
      include,
    }),
    db.changeLog.findMany({
      where: { eventType: { in: [...BULK_CHANGE_TYPES] } },
      take: 250,
      orderBy: { occurredAt: "desc" },
      include,
    }),
  ]);
  // Resolve a subject + counterpart per row. Grant/flow rows carry no entityId —
  // use the flow's recipient as subject, payer as counterpart.
  const resolve = <T extends (typeof narrative)[number]>(c: T) => {
    let subject = c.entity;
    let counterpart: typeof c.entity = null;
    if (c.relationship) {
      const subjIsSource = subject?.id === c.relationship.sourceEntityId;
      counterpart = subjIsSource ? c.relationship.targetEntity : c.relationship.sourceEntity;
      if (!subject) subject = c.relationship.sourceEntity;
    } else if (c.flow) {
      subject = subject ?? c.flow.recipientEntity ?? c.flow.payerEntity;
      counterpart = c.flow.payerEntity ?? c.flow.recipientEntity;
    }
    return { ...c, subject, counterpart };
  };

  const narrativeRows = narrative.map(resolve).filter((c) => c.subject != null).slice(0, limit);
  const bulkRows = bulk.map(resolve).filter((c) => c.subject != null);
  return [...narrativeRows, ...bulkRows].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

export type RecentChange = Awaited<ReturnType<typeof getRecentChanges>>[number];

export interface ChangeGroup {
  key: string;
  eventType: RecentChange["eventType"];
  subject: RecentChange["subject"];
  occurredAt: Date;
  items: RecentChange[];
  /** true => a bulk-ingest roll-up across many subjects, not one actor. */
  bulk?: boolean;
}

// Event types produced in high volume by a single ingestion run — roll these
// up per (type, day) so one EU-funding import is one row, not 200.
const BULK_EVENT_TYPES = new Set<RecentChange["eventType"]>([...BULK_CHANGE_TYPES]);

/**
 * Collapse a change list into feed rows (Phase 9 + 15 dedup):
 *  - bulk types (grants/contracts/entity-updates): one roll-up per event type +
 *    calendar day, across all subjects;
 *  - everything else: all entries with the same subject + event type + day are
 *    merged into one group even when other actors' events sit between them
 *    (non-consecutive grouping). Different event types are never merged.
 * Group order follows first occurrence (newest first).
 */
export function groupRecentChanges(changes: RecentChange[]): ChangeGroup[] {
  const dayOf = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const groups: ChangeGroup[] = [];
  const index = new Map<string, ChangeGroup>();

  for (const c of changes) {
    const day = dayOf(c.occurredAt);
    if (BULK_EVENT_TYPES.has(c.eventType)) {
      const k = `bulk|${c.eventType}|${day}`;
      const existing = index.get(k);
      if (existing) {
        existing.items.push(c);
        continue;
      }
      const g: ChangeGroup = { key: k, eventType: c.eventType, subject: null, occurredAt: c.occurredAt, items: [c], bulk: true };
      index.set(k, g);
      groups.push(g);
      continue;
    }
    // Non-consecutive: one group per (subject, eventType, day).
    const k = `${c.subject?.id ?? "?"}|${c.eventType}|${day}`;
    const existing = index.get(k);
    if (existing) {
      existing.items.push(c);
      continue;
    }
    const g: ChangeGroup = { key: c.id, eventType: c.eventType, subject: c.subject, occurredAt: c.occurredAt, items: [c] };
    index.set(k, g);
    groups.push(g);
  }
  return groups;
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

export async function getStats() {
  const [persons, organizations, verifiedRelationships, sources, flows] = await Promise.all([
    db.entity.count({ where: { type: "PERSON" } }),
    db.entity.count({ where: { NOT: { type: "PERSON" } } }),
    db.relationship.count({ where: publicVisibleWhere }),
    db.source.count(),
    db.financialFlow.count({ where: publicVisibleWhere }),
  ]);
  return { persons, organizations, verifiedRelationships, sources, flows };
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