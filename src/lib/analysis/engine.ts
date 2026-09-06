// Content analysis engine (sections 4, 13, 16, 18).
//
// Deterministic, versioned aggregation over the Article corpus. Identical
// inputs always produce identical results (algorithmVersion pins the method).
// Results are DATA-ANALYSIS: they describe publication metadata, never a
// person's political view. Political affiliations are never derived here.

import { createHash } from "node:crypto";
import type { Prisma, AnalysisScope, AnalysisKind, JournalisticGenre } from "@prisma/client";
import { db } from "@/lib/db";
import { estimateFraming, framingConfidence, type FramingBucket } from "@/lib/analysis/framing";
import type {
  AnalysisQuery,
  CoverageResult,
  DistributionBucket,
  EntityRef,
  PartyCoverageBucket,
  PersonCoverageBucket,
  FramingEstimate,
  ScopeHashInput,
} from "./types";
import { CONTENT_ANALYSIS_ALGORITHM } from "./types";

export { CONTENT_ANALYSIS_ALGORITHM, MENTION_ROLE_KEYS, GENRE_KEYS } from "./types";

// ---------------------------------------------------------------------------- corpus

interface CorpusArticle {
  id: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  genre: JournalisticGenre;
  topics: string[];
  publisher: EntityRef | null;
  mentions: {
    entity: EntityRef;
    mentionRole: string;
    headlineMention: boolean;
  }[];
}

async function fetchCorpus(scope: AnalysisScope, entityId: string, q: AnalysisQuery): Promise<CorpusArticle[]> {
  const where: Prisma.ArticleWhereInput = { publicVisible: true };
  if (q.periodStart || q.periodEnd) {
    where.publishedAt = {
      gte: q.periodStart ?? undefined,
      lte: q.periodEnd ?? undefined,
    };
  }
  if (scope === "JOURNALIST") {
    const authored = await db.articleAuthor.findMany({
      where: { personEntityId: entityId },
      select: { articleId: true },
    });
    where.id = { in: authored.map((a) => a.articleId) };
  } else if (scope === "MEDIA_OUTLET") {
    where.publisherEntityId = entityId;
  } else {
    return [];
  }
  const rows = await db.article.findMany({
    where,
    select: {
      id: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      genre: true,
      topics: true,
      publicationName: true,
      publisherEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
      mentions: {
        select: {
          headlineMention: true,
          mentionRole: true,
          entity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt,
    genre: r.genre,
    topics: r.topics,
    publisher: r.publisherEntity
      ? { id: r.publisherEntity.id, name: r.publisherEntity.canonicalName, type: r.publisherEntity.type, subtype: r.publisherEntity.subtype }
      : r.publicationName
        ? { id: "", name: r.publicationName, type: "MEDIA_ORGANIZATION", subtype: null }
        : null,
    mentions: r.mentions.map((m) => ({
      entity: { id: m.entity.id, name: m.entity.canonicalName, type: m.entity.type, subtype: m.entity.subtype },
      mentionRole: m.mentionRole,
      headlineMention: m.headlineMention,
    })),
  }));
}

// ---------------------------------------------------------------------------- aggregation

function bucketize(map: Map<string, number>, nameOf: (k: string) => string, cap = 100): DistributionBucket[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, name: nameOf(key), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fi"))
    .slice(0, cap);
}

function periodParams(q: AnalysisQuery): { start: string | null; end: string | null } {
  return {
    start: q.periodStart ? q.periodStart.toISOString().slice(0, 10) : null,
    end: q.periodEnd ? q.periodEnd.toISOString().slice(0, 10) : null,
  };
}

function robustness(corpusSize: number, politicsCount: number): number {
  if (corpusSize === 0) return 0;
  const size = Math.min(1, corpusSize / 300);
  const pol = Math.min(1, politicsCount / 80);
  return Number((0.45 * size + 0.55 * pol).toFixed(3));
}

async function politicianSet(articles: CorpusArticle[]): Promise<Set<string>> {
  const personIds = [
    ...new Set(articles.flatMap((a) => a.mentions.filter((m) => m.entity.type === "PERSON").map((m) => m.entity.id))),
  ];
  if (personIds.length === 0) return new Set();
  const persons = await db.person.findMany({
    where: { entityId: { in: personIds } },
    select: { entityId: true, partyEntityId: true },
  });
  return new Set(persons.filter((p) => p.partyEntityId).map((p) => p.entityId));
}

/**
 * Compute a CoverageResult for one scope. Pure aggregation over the fetched
 * corpus; the DB is touched only to resolve politician identity.
 */
export async function computeCoverage(scope: AnalysisScope, entityId: string, q: AnalysisQuery = {}): Promise<CoverageResult> {
  const articles = await fetchCorpus(scope, entityId, q);
  const pols = await politicianSet(articles);
  const partOfPolitics = (a: CorpusArticle) =>
    a.mentions.some((m) => m.entity.type === "POLITICAL_PARTY" || (m.entity.type === "PERSON" && pols.has(m.entity.id)));

  const publisherMap = new Map<string, number>();
  const genreMap = new Map<JournalisticGenre, number>();
  const topicMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const sourceRoleMap = new Map<string, number>();
  const partyMap = new Map<string, number>();
  const partyFraming = new Map<string, { positive: number; neutral: number; critical: number }>();
  const personMap = new Map<string, number>();
  const expertMap = new Map<string, number>();
  const nameOf = new Map<string, string>();
  let headlineCount = 0;
  let politicsCount = 0;
  const framings: FramingBucket[] = [];

  for (const a of articles) {
    headlineCount += a.mentions.some((m) => m.headlineMention) ? 1 : 0;
    if (a.publisher) publisherMap.set(a.publisher.id === "" ? `name|${a.publisher.name}` : a.publisher.id, (publisherMap.get(a.publisher.id === "" ? `name|${a.publisher.name}` : a.publisher.id) ?? 0) + 1);
    genreMap.set(a.genre, (genreMap.get(a.genre) ?? 0) + 1);
    for (const t of a.topics) topicMap.set(t, (topicMap.get(t) ?? 0) + 1);

    const isPol = partOfPolitics(a);
    let articleFraming: FramingBucket | null = null;
    if (q.includeFraming !== false && isPol) {
      articleFraming = estimateFraming(`${a.title} ${a.excerpt ?? ""}`);
      framings.push(articleFraming);
    }

    for (const m of a.mentions) {
      nameOf.set(m.entity.id, m.entity.name);
      sourceRoleMap.set(m.mentionRole, (sourceRoleMap.get(m.mentionRole) ?? 0) + 1);
      if (m.mentionRole === "COUNTRY" || m.entity.subtype === "COUNTRY") {
        countryMap.set(m.entity.id, (countryMap.get(m.entity.id) ?? 0) + 1);
      }
      if (m.mentionRole === "TOPIC") {
        nameOf.set(m.entity.id, m.entity.name);
        topicMap.set(m.entity.id === "" ? m.entity.name : m.entity.id, (topicMap.get(m.entity.id === "" ? m.entity.name : m.entity.id) ?? 0) + 1);
      }
      if (m.mentionRole === "SUBJECT" && m.entity.type === "POLITICAL_PARTY") {
        partyMap.set(m.entity.id, (partyMap.get(m.entity.id) ?? 0) + 1);
        if (articleFraming) {
          const cur = partyFraming.get(m.entity.id) ?? { positive: 0, neutral: 0, critical: 0 };
          cur[articleFraming === "positive" ? "positive" : articleFraming === "critical" ? "critical" : "neutral"] += 1;
          partyFraming.set(m.entity.id, cur);
        }
      }
      if (m.mentionRole === "SUBJECT" && m.entity.type === "PERSON" && m.entity.id !== entityId) {
        personMap.set(m.entity.id, (personMap.get(m.entity.id) ?? 0) + 1);
      }
      if (m.mentionRole === "QUOTED_EXPERT") {
        expertMap.set(m.entity.id, (expertMap.get(m.entity.id) ?? 0) + 1);
      }
    }
  }

  politicsCount = articles.filter(partOfPolitics).length;

  const partyBuckets: PartyCoverageBucket[] = [...partyMap.entries()]
    .map(([id, count]) => {
      const f = partyFraming.get(id);
      return {
        key: id,
        name: nameOf.get(id) ?? id,
        count,
        shareOfPoliticsPct: politicsCount > 0 ? Number(((count / politicsCount) * 100).toFixed(1)) : 0,
        framing: f
          ? {
              positive: f.positive,
              neutral: f.neutral,
              critical: f.critical,
              total: f.positive + f.neutral + f.critical,
              method: "lexicon_v1" as const,
              confidence: 0.2,
              limitation: "Automaattinen leksikonarvio lyhyestä otsikosta/johdannosta; ei ole luotettava yksittäinen arvio.",
            }
          : null,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fi"))
    .slice(0, 40);

  const politicianBuckets: PersonCoverageBucket[] = personMapToBuckets(personMap, nameOf, pols);

  let framing: FramingEstimate | null = null;
  if (framings.length > 0) {
    const positive = framings.filter((f) => f === "positive").length;
    const critical = framings.filter((f) => f === "critical").length;
    const neutral = framings.length - positive - critical;
    framing = {
      positive,
      neutral,
      critical,
      total: framings.length,
      method: "lexicon_v1",
      confidence: framingConfidence(
        "neutral",
        Math.max(framings.length, articles.reduce((s, a) => s + (a.title.length + (a.excerpt?.length ?? 0)), 1) / Math.max(1, framings.length)),
      ),
      limitation:
        "Automaattinen leksikonestimointi otsikosta ja lyhyestä johdannosta. Epätarkka: ei osoita toimittajan tai median kantaa, vain karkeita tekstimerkkejä.",
    };
  }

  return {
    algorithmVersion: CONTENT_ANALYSIS_ALGORITHM,
    period: periodParams(q),
    corpusSize: articles.length,
    politicsArticleCount: politicsCount,
    headlineCount,
    publishers: bucketize(publisherMap, (k) => k),
    genres: bucketize(genreMap, (k) => k),
    topics: bucketize(topicMap, (k) => k),
    countries: bucketize(countryMap, (k) => nameOf.get(k) ?? k),
    sourceRoles: bucketize(sourceRoleMap, (k) => k),
    parties: partyBuckets,
    politicians: politicianBuckets,
    quotedExperts: personMapToBuckets(expertMap, nameOf, new Set()),
    framing,
    robustness: robustness(articles.length, politicsCount),
    limitations: [
      "Aineisto koostuu hakutoiminnon ja luokittelun tuottamasta julkaisumetadasta; artikkeliaineisto voi olla puutteellista.",
      "Jakaumat kertovat mitä ja ketä on käsitelty — eivät henkilön omaa käsitystä. 'Sisältöanalyysi ei osoita toimittajan henkilökohtaista poliittista mielipidettä.'",
      "Kehystys (positiivinen/neutraali/kriittinen) on automaattinen leksikonarvio ja voi sisältää virheitä.",
      "Hallitus-oppositio-jakaumaa ei tunnisteta automaattisesti; se näytetään vain silloin, kun lähdeaineisto sen erikseen koodaa.",
    ],
  };
}

function personMapToBuckets(map: Map<string, number>, nameOf: Map<string, string>, pols: Set<string>): PersonCoverageBucket[] {
  return [...map.entries()]
    .map(([id, count]) => ({
      key: id,
      name: nameOf.get(id) ?? id,
      count,
      type: "PERSON",
      isPolitician: pols.has(id),
      articleCount: count,
    }))
    .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name, "fi"))
    .slice(0, 40);
}

// ---------------------------------------------------------------------------- scope hash + persistence

export function scopeHash(input: ScopeHashInput): string {
  const key = [
    input.scope,
    input.entityId ?? "",
    input.periodStart ?? "",
    input.periodEnd ?? "",
    input.kind,
    input.algorithmVersion,
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Compute and persist a versioned ContentAnalysis row (upserted by scopeHash).
 * Returns the computed result (computation is always fresh and deterministic;
 * the stored copy is a cache for review/transparency).
 */
export async function computeAndStoreAnalysis(
  scope: AnalysisScope,
  kind: AnalysisKind,
  entityId: string | null,
  q: AnalysisQuery = {},
): Promise<CoverageResult> {
  if (!entityId) throw new Error("analysis requires scopeEntityId");
  const result = await computeCoverage(scope, entityId, q);
  const hash = scopeHash({
    scope,
    entityId,
    periodStart: result.period.start,
    periodEnd: result.period.end,
    kind,
    algorithmVersion: result.algorithmVersion,
  });
  await db.contentAnalysis.upsert({
    where: { scopeHash: hash },
    create: {
      scope,
      scopeEntityId: entityId,
      scopeHash: hash,
      kind,
      periodStart: result.period.start ? new Date(result.period.start) : undefined,
      periodEnd: result.period.end ? new Date(result.period.end) : undefined,
      corpusSize: result.corpusSize,
      articleCount: result.corpusSize,
      politicsArticleCount: result.politicsArticleCount,
      algorithmVersion: result.algorithmVersion,
      confidenceScore: result.robustness,
      result: result as unknown as Prisma.InputJsonValue,
      summary: `Laskettu aineistosta: ${result.corpusSize} juttua, ${result.politicsArticleCount} politiikka-aiheista.`,
    },
    update: {
      computedAt: new Date(),
      corpusSize: result.corpusSize,
      articleCount: result.corpusSize,
      politicsArticleCount: result.politicsArticleCount,
      algorithmVersion: result.algorithmVersion,
      confidenceScore: result.robustness,
      result: result as unknown as Prisma.InputJsonValue,
      summary: `Laskettu aineistosta: ${result.corpusSize} juttua, ${result.politicsArticleCount} politiikka-aiheista.`,
    },
  });
  return result;
}

// ---------------------------------------------------------------------------- comparison

export interface ComparisonItem {
  entity: EntityRef;
  corpusSize: number;
  politicsArticleCount: number;
  genres: DistributionBucket[];
  parties: PartyCoverageBucket[];
  politicians: PersonCoverageBucket[];
  topics: DistributionBucket[];
  period: { start: string | null; end: string | null };
}

/**
 * Side-by-side coverage comparison for 2–5 journalists (or media outlets).
 * Pure data display — never a winner.
 */
export async function computeComparison(
  scope: AnalysisScope,
  entityIds: string[],
  q: AnalysisQuery = {},
): Promise<ComparisonItem[]> {
  const items: ComparisonItem[] = [];
  for (const id of entityIds.slice(0, 5)) {
    const r = await computeCoverage(scope, id, { ...q, includeFraming: false });
    const entity = await db.entity.findUnique({
      where: { id },
      select: { id: true, canonicalName: true, type: true, subtype: true },
    });
    if (!entity) continue;
    items.push({
      entity: { id: entity.id, name: entity.canonicalName, type: entity.type, subtype: entity.subtype },
      corpusSize: r.corpusSize,
      politicsArticleCount: r.politicsArticleCount,
      genres: r.genres,
      parties: r.parties,
      politicians: r.politicians,
      topics: r.topics,
      period: r.period,
    });
  }
  return items;
}