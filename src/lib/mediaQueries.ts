// Journalism & media query layer (Toimittajat & media).
//
// All of these are *data views* over the publication database. Article counts
// are observed publication metadata (who wrote/mentioned whom), never a claim
// about a personal relationship or a political stance.

import { db } from "@/lib/db";
import { publicVisibleWhere } from "@/lib/verification";
import { JOURNALIST_SUBTYPES } from "@/lib/journalism";
import type { JournalisticGenre } from "@prisma/client";

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