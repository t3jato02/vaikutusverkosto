// Journalism & media query layer (Toimittajat & media).
//
// All of these are *data views* over the publication database. Article counts
// are observed publication metadata (who wrote/mentioned whom), never a claim
// about a personal relationship or a political stance.

import { db } from "@/lib/db";
import { publicVisibleWhere } from "@/lib/verification";
import { JOURNALIST_SUBTYPES } from "@/lib/journalism";
import { PUBLIC_BENEFIT_STATUSES } from "@/lib/benefits";
import type { JournalisticGenre, EntityType } from "@prisma/client";

// ---------------------------------------------------------------------------- journalists

export interface JournalistListRow {
  id: string;
  name: string;
  subtype: string;
  currentRole: string | null;
  employerId: string | null;
  employerName: string | null;
  employerType: string | null;
  specialties: string[];
  topics: string[];
  articleCount: number;
  sourceCount: number;
}

export async function listJournalists(opts: { mediaSlug?: string; role?: string; q?: string } = {}) {
  const where: Record<string, unknown> = {
    type: "PERSON",
    subtype: { in: [...JOURNALIST_SUBTYPES] },
  };
  if (opts.role) where.subtype = { in: [opts.role] };
  if (opts.q) where.canonicalName = { contains: opts.q, mode: "insensitive" };
  const entities = await db.entity.findMany({
    where: where as never,
    orderBy: { canonicalName: "asc" },
    select: {
      id: true,
      canonicalName: true,
      subtype: true,
      sourceCount: true,
      person: { select: { specialties: true, topicAreas: true } },
      orgPositions: { where: { isCurrent: true }, select: { role: true, organizationEntity: { select: { id: true, canonicalName: true, type: true } } }, take: 1 },
    },
  });
  const ids = entities.map((e) => e.id);
  const counts = await articleCountsByAuthor(ids);

  let rows: JournalistListRow[] = entities.map((e) => {
    const pos = e.orgPositions[0];
    return {
      id: e.id,
      name: e.canonicalName,
      subtype: e.subtype ?? "JOURNALIST",
      currentRole: pos?.role ?? null,
      employerId: pos?.organizationEntity?.id ?? null,
      employerName: pos?.organizationEntity?.canonicalName ?? null,
      employerType: pos?.organizationEntity?.type ?? null,
      specialties: e.person?.specialties ?? [],
      topics: e.person?.topicAreas ?? [],
      articleCount: counts.get(e.id) ?? 0,
      sourceCount: e.sourceCount,
    };
  });

  if (opts.mediaSlug && opts.mediaSlug.trim()) {
    rows = rows.filter((r) => r.employerId && matchesSlug(r.employerId, opts.mediaSlug as string));
  }
  return rows.sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name, "fi"));
}

async function articleCountsByAuthor(personIds: string[]): Promise<Map<string, number>> {
  if (personIds.length === 0) return new Map();
  const groups = await db.articleAuthor.groupBy({
    by: ["personEntityId"],
    where: { personEntityId: { in: personIds }, article: { publicVisible: true } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.personEntityId, g._count._all]));
}

function matchesSlug(id: string, slug: string): boolean {
  return id.startsWith(slug) || slug.includes(id.slice(0, 8));
}

// ---------------------------------------------------------------------------- media outlets

export interface MediaListRow {
  id: string;
  name: string;
  subtype: string | null;
  mediaOutletType: string | null;
  websiteUrl: string | null;
  editorialAffiliationType: string;
  editorialAffiliationParty: string | null;
  ownerId: string | null;
  ownerName: string | null;
  journalistCount: number;
  articleCount: number;
}

export async function listMediaOutlets(opts: { outletType?: string; q?: string } = {}) {
  const where: Record<string, unknown> = { type: "MEDIA_ORGANIZATION" };
  if (opts.q) where.canonicalName = { contains: opts.q, mode: "insensitive" };
  const entities = await db.entity.findMany({
    where: where as never,
    orderBy: { canonicalName: "asc" },
    select: {
      id: true,
      canonicalName: true,
      subtype: true,
      mediaOutlet: true,
      inRelations: {
        where: { relationshipType: "OWNED_BY", ...publicVisibleWhere },
        select: { sourceEntity: { select: { id: true } }, targetEntity: { select: { id: true, canonicalName: true } } },
      },
    },
  });
  const ids = entities.map((e) => e.id);
  const [journalistGroups, articleGroups] = await Promise.all([
    db.position.groupBy({ by: ["organizationEntityId"], where: { organizationEntityId: { in: ids }, isCurrent: true }, _count: { _all: true } }),
    db.article.groupBy({ by: ["publisherEntityId"], where: { publisherEntityId: { in: ids }, publicVisible: true }, _count: { _all: true } }),
  ]);
  const jCount = new Map(journalistGroups.map((g) => [g.organizationEntityId, g._count._all]));
  const aCount = new Map(articleGroups.map((g) => [g.publisherEntityId, g._count._all]));

  let rows: MediaListRow[] = entities.map((e) => {
    const ownerRel = e.inRelations[0];
    return {
      id: e.id,
      name: e.canonicalName,
      subtype: e.subtype,
      mediaOutletType: e.mediaOutlet?.mediaOutletType ?? null,
      websiteUrl: e.mediaOutlet?.websiteUrl ?? null,
      editorialAffiliationType: e.mediaOutlet?.editorialAffiliationType ?? "UNKNOWN",
      editorialAffiliationParty: null,
      ownerId: ownerRel?.targetEntity?.id ?? null,
      ownerName: ownerRel?.targetEntity?.canonicalName ?? null,
      journalistCount: jCount.get(e.id) ?? 0,
      articleCount: aCount.get(e.id) ?? 0,
    };
  });
  if (opts.outletType) rows = rows.filter((r) => r.mediaOutletType === opts.outletType);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "fi"));
}

// ---------------------------------------------------------------------------- profiles

export async function getJournalistProfile(entityId: string) {
  const [entity, positions, relationships, articles, affiliations, personalFacts, evidence] = await Promise.all([
    db.entity.findUnique({
      where: { id: entityId },
      include: { person: true, aliases: true, externalIds: true },
    }),
    db.position.findMany({
      where: { personEntityId: entityId },
      include: { source: true, organizationEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } } },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    }),
    db.relationship.findMany({
      where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }], ...publicVisibleWhere },
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
        evidence: { include: { source: true } },
      },
      orderBy: [{ temporalState: "asc" }, { updatedAt: "desc" }],
      take: 300,
    }),
    db.article.findMany({
      where: { authors: { some: { personEntityId: entityId } }, publicVisible: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        canonicalUrl: true,
        publishedAt: true,
        genre: true,
        topics: true,
        publisherEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
      },
    }),
    db.politicalAffiliation.findMany({
      where: { personEntityId: entityId, reviewStatus: "PUBLISHED" },
      include: { partyEntity: { select: { id: true, canonicalName: true, type: true } } },
      orderBy: [{ startYear: "desc" }, { publicationDate: "desc" }],
    }),
    db.personalFact.findMany({
      where: { personEntityId: entityId },
      orderBy: [{ factType: "asc" }, { createdAt: "desc" }],
    }),
    db.evidence.findMany({
      where: { entityId },
      include: { source: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const currentPosition = positions.find((p) => p.isCurrent) ?? positions[0];
  return { entity, positions, relationships, articles, affiliations, personalFacts, evidence, currentPosition };
}

export async function getMediaProfile(entityId: string) {
  const [entity, outlet, journalists, relationships, articleStats, latestArticles] = await Promise.all([
    db.entity.findUnique({ where: { id: entityId }, include: { aliases: true, organization: true } }),
    db.mediaOutlet.findUnique({ where: { entityId } }),
    db.position.findMany({
      where: { organizationEntityId: entityId, isCurrent: true },
      include: { personEntity: { select: { id: true, canonicalName: true, subtype: true } } },
      orderBy: { role: "asc" },
      take: 100,
    }),
    db.relationship.findMany({
      where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }], ...publicVisibleWhere },
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
        evidence: { include: { source: true } },
      },
      orderBy: [{ temporalState: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    db.article.count({
      where: { publisherEntityId: entityId, publicVisible: true },
    }),
    db.article.findMany({
      where: { publisherEntityId: entityId, publicVisible: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true, title: true, canonicalUrl: true, publishedAt: true, genre: true },
    }),
  ]);

  const party = outlet?.editorialAffiliationPartyEntityId
    ? await db.entity.findUnique({ where: { id: outlet.editorialAffiliationPartyEntityId }, select: { id: true, canonicalName: true } })
    : null;
  const ownerRel = relationships.find((r) => r.relationshipType === "OWNED_BY" && r.sourceEntityId === entityId);
  const owner = ownerRel ? ownerRel.targetEntity : null;

  return { entity, outlet, journalists, relationships, articleStats, latestArticles, party, owner };
}

// ---------------------------------------------------------------------------- public media finance (section 3 & 6)

export interface FinanceYear {
  year: number;
  income: { category: string; categoryLabel: string; amount: number; valueType: string; isTotal: boolean; note: string | null; reportUrl: string }[];
  expenditure: { category: string; categoryLabel: string; amount: number; valueType: string; isTotal: boolean; note: string | null; reportUrl: string }[];
}

/** Year-by-year financial-statement line items for an organisation. */
export async function getMediaFinance(entityId: string): Promise<FinanceYear[]> {
  const rows = await db.financialStatementItem.findMany({
    where: { entityId },
    orderBy: [{ fiscalYear: "desc" }, { kind: "asc" }],
    select: {
      fiscalYear: true,
      kind: true,
      category: true,
      categoryLabel: true,
      amount: true,
      currency: true,
      valueType: true,
      isTotal: true,
      note: true,
      reportUrl: true,
      lastVerifiedAt: true,
    },
  });
  const byYear = new Map<number, FinanceYear>();
  for (const r of rows) {
    const y = byYear.get(r.fiscalYear) ?? { year: r.fiscalYear, income: [], expenditure: [] };
    const item = { category: r.category, categoryLabel: r.categoryLabel, amount: Number(r.amount), valueType: r.valueType, isTotal: r.isTotal, note: r.note, reportUrl: r.reportUrl };
    (r.kind === "INCOME" ? y.income : y.expenditure).push(item);
    byYear.set(r.fiscalYear, y);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

export interface GovernanceBlock {
  positions: {
    personId: string;
    name: string;
    role: string;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    type: EntityType;
    evidenceUrl: string | null;
  }[];
  council: {
    id: string;
    name: string;
    role: string | null;
    members: { personId: string; name: string; role: string; startDate: Date | null; endDate: Date | null }[];
    sourceUrl: string | null;
  } | null;
}

/** Leadership positions + administrative council for a media organisation. */
export async function getMediaGovernance(entityId: string): Promise<GovernanceBlock> {
  const positions = await db.position.findMany({
    where: { organizationEntityId: entityId },
    include: { personEntity: { select: { id: true, canonicalName: true, type: true } }, source: { select: { sourceUrl: true } } },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    take: 120,
  });

  // Administrative council: find an entity that SUPERVISES this org, then list
  // its current members (maintained by the parliament agent / Eduskunta data).
  const councilRels = await db.relationship.findMany({
    where: { relationshipType: "SUPERVISES", targetEntityId: entityId, ...publicVisibleWhere },
    include: { evidence: { include: { source: { select: { sourceUrl: true } } }, take: 1 } },
    take: 1,
  });
  let council: GovernanceBlock["council"] = null;
  if (councilRels.length > 0) {
    const councilEntity = await db.entity.findUnique({
      where: { id: councilRels[0].sourceEntityId },
      select: { id: true, canonicalName: true, description: true },
    });
    if (councilEntity) {
      const members = await db.relationship.findMany({
        where: {
          targetEntityId: councilEntity.id,
          relationshipType: "MEMBER_OF",
          ...publicVisibleWhere,
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
        include: { sourceEntity: { select: { id: true, canonicalName: true } } },
        orderBy: { role: "asc" },
        take: 60,
      });
      council = {
        id: councilEntity.id,
        name: councilEntity.canonicalName,
        role: councilRels[0].role ?? null,
        members: members.map((m) => ({
          personId: m.sourceEntity.id,
          name: m.sourceEntity.canonicalName,
          role: m.role ?? "Jäsen",
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        sourceUrl: councilRels[0].evidence[0]?.source?.sourceUrl ?? null,
      };
    }
  }

  return {
    positions: positions.map((p) => ({
      personId: p.personEntity.id,
      name: p.personEntity.canonicalName,
      role: p.role,
      startDate: p.startDate,
      endDate: p.endDate,
      isCurrent: p.isCurrent,
      type: p.personEntity.type,
      evidenceUrl: p.source?.sourceUrl ?? null,
    })),
    council,
  };
}

export interface BenefitRow {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  eventDate: Date | null;
  monetaryValue: number | null;
  currency: string | null;
  valueType: string;
  selectionRole: string | null;
  country: string | null;
  recipient: { id: string; canonicalName: string } | null;
  giver: { id: string; canonicalName: string } | null;
  payer: { id: string; canonicalName: string } | null;
  evidenceGrade: string;
  sourceUrl: string | null;
  sourceName: string | null;
}

/** Published benefit events (awards, gifts, honours) touching an entity. */
export async function getEntityBenefits(entityId: string): Promise<BenefitRow[]> {
  const rows = await db.benefitEvent.findMany({
    where: {
      reviewStatus: { in: PUBLIC_BENEFIT_STATUSES },
      OR: [
        { recipientEntityId: entityId },
        { giverEntityId: entityId },
        { payerEntityId: entityId },
        { beneficiaryEntityId: entityId },
      ],
    },
    include: {
      recipientEntity: { select: { id: true, canonicalName: true } },
      giverEntity: { select: { id: true, canonicalName: true } },
      payerEntity: { select: { id: true, canonicalName: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    title: r.title,
    description: r.description,
    eventDate: r.eventDate,
    monetaryValue: r.monetaryValue ? Number(r.monetaryValue) : null,
    currency: r.currency,
    valueType: r.valueType,
    selectionRole: r.selectionRole,
    country: r.country,
    recipient: r.recipientEntity,
    giver: r.giverEntity,
    payer: r.payerEntity,
    evidenceGrade: r.evidenceGrade,
    sourceUrl: r.source?.sourceUrl ?? null,
    sourceName: r.source?.sourceName ?? null,
  }));
}

export interface TimelineEntry {
  date: Date | null;
  label: string;
  detail: string | null;
  kind: "role" | "money" | "event";
}

/** Recent published award/benefit events for the Explore view. */
export async function getRecentBenefits(limit = 30): Promise<(BenefitRow & { updatedAt: Date })[]> {
  const rows = await db.benefitEvent.findMany({
    where: { reviewStatus: { in: PUBLIC_BENEFIT_STATUSES } },
    include: {
      recipientEntity: { select: { id: true, canonicalName: true } },
      giverEntity: { select: { id: true, canonicalName: true } },
      payerEntity: { select: { id: true, canonicalName: true } },
      source: { select: { sourceUrl: true, sourceName: true } },
    },
    orderBy: [{ eventDate: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    title: r.title,
    description: r.description,
    eventDate: r.eventDate,
    monetaryValue: r.monetaryValue ? Number(r.monetaryValue) : null,
    currency: r.currency,
    valueType: r.valueType,
    selectionRole: r.selectionRole,
    country: r.country,
    recipient: r.recipientEntity,
    giver: r.giverEntity,
    payer: r.payerEntity,
    evidenceGrade: r.evidenceGrade,
    sourceUrl: r.source?.sourceUrl ?? null,
    sourceName: r.source?.sourceName ?? null,
    updatedAt: r.updatedAt,
  }));
}

/** Top awarding organisations (documented, published awards). */
export async function getTopAwardGivers(limit = 10): Promise<{ id: string; name: string; awards: number }[]> {
  const groups = await db.benefitEvent.groupBy({
    by: ["giverEntityId"],
    where: { reviewStatus: { in: PUBLIC_BENEFIT_STATUSES }, giverEntityId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { giverEntityId: "desc" } },
    take: limit,
  });
  const ids = groups.map((g) => g.giverEntityId!).filter(Boolean);
  const entities = ids.length ? await db.entity.findMany({ where: { id: { in: ids } }, select: { id: true, canonicalName: true } }) : [];
  const byId = new Map(entities.map((e) => [e.id, e.canonicalName]));
  return groups.map((g) => ({ id: g.giverEntityId!, name: byId.get(g.giverEntityId!) ?? "—", awards: g._count._all })).sort((a, b) => b.awards - a.awards);
}

/** Lightweight timeline: leadership roles + funding milestones + benefit events. */
export async function getMediaTimeline(entityId: string, finance: FinanceYear[]): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  const positions = await db.position.findMany({
    where: { organizationEntityId: entityId },
    select: { role: true, startDate: true, endDate: true, personEntity: { select: { canonicalName: true } } },
  });
  for (const p of positions) {
    entries.push({ date: p.startDate, label: p.role ?? "Tehtävä", detail: p.personEntity.canonicalName, kind: "role" });
  }
  for (const y of finance) {
    const total = y.income.find((i) => i.isTotal) ?? y.income[0];
    if (total) entries.push({ date: new Date(Date.UTC(y.year, 11, 31)), label: `Kokonaistuotot ${y.year}`, detail: null, kind: "money" });
  }
  const benefits = await getEntityBenefits(entityId);
  for (const b of benefits) {
    entries.push({ date: b.eventDate, label: b.title, detail: b.giver?.canonicalName ?? null, kind: "event" });
  }
  return entries
    .filter((e) => e.date)
    .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
    .slice(0, 150);
}

// ---------------------------------------------------------------------------- politician ↔ media (section 8)

export interface CoverageArticle {
  id: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  genre: JournalisticGenre;
  outlet: string | null;
}

/** Articles in the corpus that *mention* the given person, newest first. */
export async function articlesMentioning(personEntityId: string, limit = 100): Promise<CoverageArticle[]> {
  const rows = await db.article.findMany({
    where: { mentions: { some: { entityId: personEntityId } }, publicVisible: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      publishedAt: true,
      genre: true,
      publisherEntity: { select: { canonicalName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.canonicalUrl,
    publishedAt: r.publishedAt,
    genre: r.genre,
    outlet: r.publisherEntity?.canonicalName ?? "Tuntematon julkaisija",
  }));
}

/** Politician's "Media & toimittajat" summary (observable publication data). */
export async function politicianMediaSummary(personEntityId: string) {
  const articles = await articlesMentioning(personEntityId, 500);
  const articleIds = articles.map((a) => a.id);
  const authorRows: { articleId: string; personEntityId: string; canonicalName: string }[] = [];
  if (articleIds.length > 0) {
    const rows = await db.articleAuthor.findMany({
      where: { articleId: { in: articleIds } },
      select: { articleId: true, personEntity: { select: { id: true, canonicalName: true } } },
    });
    for (const r of rows) authorRows.push({ articleId: r.articleId, personEntityId: r.personEntity.id, canonicalName: r.personEntity.canonicalName });
  }
  const byJournalist = new Map<string, { name: string; count: number; outlets: Set<string> }>();
  const outletByArticle = new Map(articles.map((a) => [a.id, a.outlet]));
  for (const au of authorRows) {
    const cur = byJournalist.get(au.personEntityId) ?? { name: au.canonicalName, count: 0, outlets: new Set<string>() };
    cur.count += 1;
    const outlet = outletByArticle.get(au.articleId);
    if (outlet) cur.outlets.add(outlet);
    byJournalist.set(au.personEntityId, cur);
  }
  const journalistRows = [...byJournalist.entries()]
    .map(([id, v]) => ({ journalistId: id, name: v.name, articleCount: v.count, outlets: [...v.outlets] }))
    .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name, "fi"));
  return { totalMentioningArticles: articles.length, articles: articles.slice(0, 30), journalists: journalistRows };
}