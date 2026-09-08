// Identity-framing orchestration engine (luvut 3, 13).
//
// Runs the deterministic classifier over the Article corpus and persists
// MediaIdentityMention rows plus a versioned IdentityFramingAnalysis run
// record. Recomputable: the same version over the same inputs produces the
// same mentions (upserted by unique key, never duplicated).

import type { IdentityReviewStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  analyzeArticle,
  snapshotHash,
  IDENTITY_CLASSIFIER_VERSION,
  IDENTITY_MODEL_VERSION,
  IDENTITY_PROMPT_VERSION,
  type PersonRef,
} from "./classifier";

export const IDENTITY_ALGORITHM = "identity_framing_v1";

export interface RunIdentityFramingOptions {
  scope?: "CORPUS" | "MEDIA_OUTLET" | "JOURNALIST";
  scopeEntityId?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  /** Review status written to *new* mentions (classifier defaults to pending). */
  reviewStatus?: IdentityReviewStatus;
  createdBy?: string;
  note?: string;
  limit?: number;
}

export interface RunIdentityFramingResult {
  articlesScanned: number;
  mentionsWritten: number;
  touchedArticles: string[];
  snapshot: string;
}

export function identityRunScopeHash(input: {
  scope: string;
  entityId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}): string {
  return createHash("sha256")
    .update([input.scope, input.entityId ?? "", input.periodStart ?? "", input.periodEnd ?? "", IDENTITY_CLASSIFIER_VERSION].join("|"))
    .digest("hex");
}

interface ArticlePerson extends PersonRef {
  headlineMention: boolean;
}

async function articlePersonRefs(articleIds: string[]): Promise<Map<string, ArticlePerson[]>> {
  const map = new Map<string, ArticlePerson[]>();
  if (articleIds.length === 0) return map;
  const mentionRows = await db.articleMention.findMany({
    where: { articleId: { in: articleIds }, entity: { type: "PERSON" } },
    select: {
      articleId: true,
      entityId: true,
      headlineMention: true,
      entity: {
        select: {
          canonicalName: true,
          person: { select: { firstName: true, lastName: true } },
          aliases: { select: { name: true } },
        },
      },
    },
  });
  for (const row of mentionRows) {
    const names = [row.entity.canonicalName];
    if (row.entity.person?.firstName) names.push(row.entity.person.firstName);
    if (row.entity.person?.lastName) names.push(row.entity.person.lastName);
    for (const a of row.entity.aliases) names.push(a.name);
    const cur = map.get(row.articleId) ?? [];
    const existing = cur.find((c) => c.entityId === row.entityId);
    if (existing) {
      existing.headlineMention = existing.headlineMention || row.headlineMention;
      continue;
    }
    cur.push({
      entityId: row.entityId,
      names: [...new Set(names.filter((n) => n && n.trim().length >= 2))],
      headlineMention: row.headlineMention,
    });
    map.set(row.articleId, cur);
  }
  return map;
}

/** Core classification + persistence path. Used by the seed script and cron. */
export async function runIdentityFraming(opts: RunIdentityFramingOptions = {}): Promise<RunIdentityFramingResult> {
  const reviewStatus = opts.reviewStatus ?? "PENDING_REVIEW";
  const where: Record<string, unknown> = { publicVisible: true };
  if (opts.periodStart || opts.periodEnd) {
    where.publishedAt = {
      gte: opts.periodStart ?? undefined,
      lte: opts.periodEnd ?? undefined,
    };
  }
  if (opts.scope === "MEDIA_OUTLET" && opts.scopeEntityId) {
    where.publisherEntityId = opts.scopeEntityId;
  }
  if (opts.scope === "JOURNALIST" && opts.scopeEntityId) {
    const authored = await db.articleAuthor.findMany({
      where: { personEntityId: opts.scopeEntityId },
      select: { articleId: true },
    });
    where.id = { in: authored.map((a) => a.articleId) };
  }

  const articles = await db.article.findMany({
    where: where as never,
    take: opts.limit ?? 1000,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      genre: true,
      publisherEntity: { select: { id: true } },
      authors: { select: { personEntityId: true }, take: 1, orderBy: { authorOrder: "asc" } },
    },
  });

  const refMap = await articlePersonRefs(articles.map((a) => a.id));
  let mentionsWritten = 0;
  const touched = new Set<string>();
  let totalSnapshot = createHash("sha256").update("identity-framing-run").digest("hex");

  for (const article of articles) {
    const persons = refMap.get(article.id) ?? [];
    if (persons.length === 0) continue;
    const headlineIds = new Set(persons.filter((p) => p.headlineMention).map((p) => p.entityId));
    const result = analyzeArticle({
      title: article.title,
      excerpt: article.excerpt,
      persons: persons.map(({ entityId, names }) => ({ entityId, names })),
      headlinePersonEntityIds: [...headlineIds],
    });
    if (result.mentions.length === 0) continue;
    const firstAuthor = article.authors[0]?.personEntityId ?? null;
    for (const m of result.mentions) {
      await db.mediaIdentityMention.upsert({
        where: {
          personEntityId_articleId_expressionNormalized_termCategory: {
            personEntityId: m.personEntityId,
            articleId: article.id,
            expressionNormalized: m.expressionNormalized,
            termCategory: m.termCategory,
          },
        },
        create: {
          personEntityId: m.personEntityId,
          articleId: article.id,
          expression: m.expression,
          expressionNormalized: m.expressionNormalized,
          termCategory: m.termCategory,
          context: m.context,
          inHeadline: m.inHeadline,
          mediaOutletEntityId: article.publisherEntity?.id ?? null,
          journalistEntityId: firstAuthor,
          publishedAt: article.publishedAt,
          genre: article.genre,
          analysisVersion: IDENTITY_CLASSIFIER_VERSION,
          algorithmVersion: IDENTITY_CLASSIFIER_VERSION,
          extractor: "identity-framing-classifier-v1",
          modelVersion: IDENTITY_MODEL_VERSION,
          promptVersion: IDENTITY_PROMPT_VERSION,
          confidence: m.confidence,
          sourceSnapshot: m.sourceSnapshot,
          reviewStatus,
          note: opts.reviewStatus ? `Luokittelu: ${reviewStatus} (${opts.createdBy ?? "auto"}).` : null,
        },
        update: {
          expression: m.expression,
          context: m.context,
          inHeadline: m.inHeadline,
          confidence: m.confidence,
          sourceSnapshot: m.sourceSnapshot,
          mediaOutletEntityId: article.publisherEntity?.id ?? null,
          journalistEntityId: firstAuthor,
        },
      });
      mentionsWritten += 1;
      touched.add(article.id);
    }
    totalSnapshot = snapshotHash(totalSnapshot, result.snapshot);
  }

  const scopeFinal = opts.scope ?? "CORPUS";
  const entityKey = opts.scopeEntityId ?? null;
  const periodKey = opts.periodStart ? opts.periodStart.toISOString().slice(0, 10) : null;
  const periodEndKey = opts.periodEnd ? opts.periodEnd.toISOString().slice(0, 10) : null;
  const h = identityRunScopeHash({ scope: scopeFinal, entityId: entityKey, periodStart: periodKey, periodEnd: periodEndKey });
  const runData = {
    scopeHash: h,
    scope: scopeFinal as never,
    scopeEntityId: entityKey,
    periodStart: opts.periodStart ?? null,
    periodEnd: opts.periodEnd ?? null,
    algorithm: IDENTITY_ALGORITHM,
    algorithmVersion: IDENTITY_CLASSIFIER_VERSION,
    modelVersion: IDENTITY_MODEL_VERSION,
    promptVersion: IDENTITY_PROMPT_VERSION,
    articleCount: articles.length,
    mentionCount: mentionsWritten,
    sourceSnapshot: totalSnapshot,
    confidence: articles.length > 0 ? mentionsWritten / Math.max(1, articles.length) : null,
    summary: `Luokiteltu ${articles.length} juttua, ${mentionsWritten} identiteettimainintaa (${reviewStatus}).`,
  };
  await db.identityFramingAnalysis.upsert({
    where: { scopeHash: h },
    create: runData,
    update: runData,
  });

  return {
    articlesScanned: articles.length,
    mentionsWritten,
    touchedArticles: [...touched],
    snapshot: totalSnapshot,
  };
}