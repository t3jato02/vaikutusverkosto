// Identity-framing aggregation engine (luvut 4, 5, 9, 11).
//
// Builds distributional summaries over MediaIdentityMention rows: term and
// category frequencies, cross-tabulations against documented birth country /
// citizenship / residence, city terms, documentation rate and change over
// time. Results are OBSERVATIONS of media wording — never facts about a person
// and never a verdict about the media.

import { createHash } from "node:crypto";
import type { IdentityAggregateScope } from "@prisma/client";
import { db } from "@/lib/db";
import { getPersonsIdentityFactsMap } from "./queries";
import { MIN_ANALYSIS_SAMPLE, sampleSufficient } from "./safety";
import { fixedCountryName } from "./facts";

export const IDENTITY_AGGREGATE_VERSION = "identity_framing_v1";

export interface AggregateOptions {
  scope: IdentityAggregateScope;
  entityId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  termFilter?: string | null;
  categoryFilter?: string | null;
  birthCountry?: string | null;
  citizenship?: string | null;
  residenceCountry?: string | null;
}

interface MentionRow {
  id: string;
  articleId: string;
  personEntityId: string;
  expression: string;
  expressionNormalized: string;
  termCategory: string;
  inHeadline: boolean;
  publishedAt: Date | null;
  mediaOutletEntityId: string | null;
  journalistEntityId: string | null;
}

export interface IdentityAggregateResult {
  algorithmVersion: string;
  scope: string;
  scopeEntityId: string | null;
  period: { start: string | null; end: string | null };
  corpus: {
    articleCount: number;
    mentionCount: number;
    personCount: number;
    headlineCount: number;
  };
  categories: { key: string; count: number }[];
  terms: { expression: string; category: string; count: number; personCount: number }[];
  cityTerms: { expression: string; count: number }[];
  birthCountryCross: { expression: string; category: string; total: number; birthCountryFI: number; birthCountryForeign: number; unknownBirth: number }[];
  citizenshipCross: { expression: string; category: string; total: number; withFICitizenship: number; withForeignCitizenship: number }[];
  residenceCross: { expression: string; category: string; total: number; residenceFI: number; residenceForeign: number }[];
  documentation: { mentionsWithBirthCountry: number; mentionsWithCitizenship: number; total: number; rate: number };
  overTime: { bucket: string; count: number }[];
  sampleSufficient: boolean;
  limitations: string[];
}

export function identityAggregateHash(opts: AggregateOptions): string {
  return createHash("sha256")
    .update(
      [
        opts.scope,
        opts.entityId ?? "",
        opts.periodStart?.toISOString().slice(0, 10) ?? "",
        opts.periodEnd?.toISOString().slice(0, 10) ?? "",
        opts.termFilter ?? "",
        opts.categoryFilter ?? "",
        opts.birthCountry ?? "",
        opts.citizenship ?? "",
        opts.residenceCountry ?? "",
        IDENTITY_AGGREGATE_VERSION,
      ].join("|"),
    )
    .digest("hex");
}

async function fetchMentions(opts: AggregateOptions): Promise<MentionRow[]> {
  const where: Record<string, unknown> = { reviewStatus: "PUBLISHED" };
  if (opts.periodStart || opts.periodEnd) {
    where.publishedAt = { gte: opts.periodStart ?? undefined, lte: opts.periodEnd ?? undefined };
  }
  if (opts.scope === "OUTLET" && opts.entityId) where.mediaOutletEntityId = opts.entityId;
  if (opts.scope === "JOURNALIST" && opts.entityId) where.journalistEntityId = opts.entityId;
  if (opts.scope === "PERSON" && opts.entityId) where.personEntityId = opts.entityId;
  if (opts.categoryFilter) where.termCategory = opts.categoryFilter;

  const rows = await db.mediaIdentityMention.findMany({
    where: where as never,
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      articleId: true,
      personEntityId: true,
      expression: true,
      expressionNormalized: true,
      termCategory: true,
      inHeadline: true,
      publishedAt: true,
      mediaOutletEntityId: true,
      journalistEntityId: true,
    },
  });

  // term filter (exact normalized expression)
  let out = rows;
  if (opts.termFilter) {
    const tf = opts.termFilter.toLowerCase().trim();
    out = out.filter((r) => r.expressionNormalized === tf);
  }

  // country filters resolve against documented facts
  if (opts.birthCountry || opts.citizenship || opts.residenceCountry) {
    const persons = [...new Set(out.map((r) => r.personEntityId))];
    const facts = await getPersonsIdentityFactsMap(persons);
    out = out.filter((r) => {
      const f = facts.get(r.personEntityId);
      if (!f) return false;
      if (opts.birthCountry) return f.birthCountry?.value === opts.birthCountry.toUpperCase();
      if (opts.citizenship) return f.citizenships.some((c) => c.countryCode === opts.citizenship!.toUpperCase());
      if (opts.residenceCountry) {
        const cur = f.residences.find((rs) => rs.isCurrent);
        return cur?.countryCode === opts.residenceCountry.toUpperCase();
      }
      return true;
    });
  }
  return out;
}

export async function computeIdentityAggregate(opts: AggregateOptions): Promise<IdentityAggregateResult> {
  const rows = await fetchMentions(opts);
  const personIds = [...new Set(rows.map((r) => r.personEntityId))];
  const facts = await getPersonsIdentityFactsMap(personIds);

  const categories = new Map<string, number>();
  const terms = new Map<string, { category: string; count: number; persons: Set<string> }>();
  const cityTerms = new Map<string, number>();
  const birthCross = new Map<string, { category: string; total: number; birthFI: number; birthForeign: number; unknown: number }>();
  const citizenCross = new Map<string, { category: string; total: number; fi: number; foreign: number }>();
  const residenceCross = new Map<string, { category: string; total: number; fi: number; foreign: number }>();
  const overTime = new Map<string, number>();
  let headlineCount = 0;
  let withBirth = 0;
  let withCitizenship = 0;

  for (const r of rows) {
    categories.set(r.termCategory, (categories.get(r.termCategory) ?? 0) + 1);
    if (r.inHeadline) headlineCount += 1;
    const key = r.expressionNormalized;
    const cur = terms.get(key) ?? { category: r.termCategory, count: 0, persons: new Set<string>() };
    cur.count += 1;
    cur.persons.add(r.personEntityId);
    terms.set(key, cur);

    if (r.termCategory === "CITY_IDENTITY") cityTerms.set(key, (cityTerms.get(key) ?? 0) + 1);

    const f = facts.get(r.personEntityId);
    const birthFI = f?.birthCountry?.value === "FI";
    if (f?.birthCountry) withBirth += 1;
    const hasFI = f?.citizenships.some((c) => c.countryCode === "FI");
    const hasForeign = f?.citizenships.some((c) => c.countryCode !== "FI");
    if (f?.citizenships.length) withCitizenship += 1;
    const residence = f?.residences.find((rs) => rs.isCurrent);

    const bc = birthCross.get(key) ?? { category: r.termCategory, total: 0, birthFI: 0, birthForeign: 0, unknown: 0 };
    bc.total += 1;
    if (birthFI) bc.birthFI += 1;
    else if (f?.birthCountry) bc.birthForeign += 1;
    else bc.unknown += 1;
    birthCross.set(key, bc);

    const cc = citizenCross.get(key) ?? { category: r.termCategory, total: 0, fi: 0, foreign: 0 };
    cc.total += 1;
    if (hasFI) cc.fi += 1;
    if (hasForeign) cc.foreign += 1;
    citizenCross.set(key, cc);

    const rc = residenceCross.get(key) ?? { category: r.termCategory, total: 0, fi: 0, foreign: 0 };
    rc.total += 1;
    if (residence?.countryCode === "FI") rc.fi += 1;
    else if (residence) rc.foreign += 1;
    residenceCross.set(key, rc);

    const year = r.publishedAt ? r.publishedAt.getFullYear() : null;
    if (year) {
      const bucket = Math.floor(year / 5) * 5;
      const label = `${bucket}–${bucket + 4}`;
      overTime.set(label, (overTime.get(label) ?? 0) + 1);
    }
  }

  const sortedTerms = [...terms.entries()]
    .map(([expression, v]) => ({ expression, category: v.category, count: v.count, personCount: v.persons.size }))
    .sort((a, b) => b.count - a.count || a.expression.localeCompare(b.expression, "fi"));

  const articleCount = new Set(rows.map((r) => r.articleId)).size;

  const result: IdentityAggregateResult = {
    algorithmVersion: IDENTITY_AGGREGATE_VERSION,
    scope: opts.scope,
    scopeEntityId: opts.entityId ?? null,
    period: {
      start: opts.periodStart ? opts.periodStart.toISOString().slice(0, 10) : null,
      end: opts.periodEnd ? opts.periodEnd.toISOString().slice(0, 10) : null,
    },
    corpus: {
      articleCount,
      mentionCount: rows.length,
      personCount: personIds.length,
      headlineCount,
    },
    categories: [...categories.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    terms: sortedTerms,
    cityTerms: [...cityTerms.entries()].map(([expression, count]) => ({ expression, count })).sort((a, b) => b.count - a.count),
    birthCountryCross: [...birthCross.entries()].map(([expression, v]) => ({
      expression,
      category: v.category,
      total: v.total,
      birthCountryFI: v.birthFI,
      birthCountryForeign: v.birthForeign,
      unknownBirth: v.unknown,
    })),
    citizenshipCross: [...citizenCross.entries()].map(([expression, v]) => ({
      expression,
      category: v.category,
      total: v.total,
      withFICitizenship: v.fi,
      withForeignCitizenship: v.foreign,
    })),
    residenceCross: [...residenceCross.entries()].map(([expression, v]) => ({
      expression,
      category: v.category,
      total: v.total,
      residenceFI: v.fi,
      residenceForeign: v.foreign,
    })),
    documentation: {
      mentionsWithBirthCountry: withBirth,
      mentionsWithCitizenship: withCitizenship,
      total: rows.length,
      rate: rows.length > 0 ? withBirth / rows.length : 0,
    },
    overTime: [...overTime.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, count]) => ({ bucket, count })),
    sampleSufficient: sampleSufficient(rows.length),
    limitations: [
      "Jakaumat kuvaavat median käyttämiä ilmauksia analysoiduissa artikkeleissa — ne eivät ole henkilöiden ominaisuuksia.",
      "Ristiintaulukoinnit perustuvat vain dokumentoituihin (julkaistuihin) syntymämaa-, kansalaisuus- ja asuintietoihin; puuttuva tieto on 'Ei vahvistettua tietoa', ei arvaus.",
      "Pienellä otoksella ei tehdä johtopäätöksiä (INSUFFICIENT_SAMPLE).",
    ],
  };
  return result;
}

/** Compute and persist the aggregate (upsert by scopeHash). */
export async function computeAndStoreIdentityAggregate(opts: AggregateOptions): Promise<IdentityAggregateResult> {
  const result = await computeIdentityAggregate(opts);
  const h = identityAggregateHash(opts);
  await db.identityFramingAggregate.upsert({
    where: { scopeHash: h },
    create: {
      scope: opts.scope,
      scopeEntityId: opts.entityId ?? null,
      scopeHash: h,
      filters: opts as never,
      periodStart: opts.periodStart ?? null,
      periodEnd: opts.periodEnd ?? null,
      algorithmVersion: IDENTITY_AGGREGATE_VERSION,
      sampleSize: result.corpus.personCount,
      mentionCount: result.corpus.mentionCount,
      result: result as never,
    },
    update: {
      sampleSize: result.corpus.personCount,
      mentionCount: result.corpus.mentionCount,
      result: result as never,
    },
  });
  return result;
}

/** Small helper: does the aggregate have enough data to draw conclusions? */
export function aggregateSampleSufficient(result: IdentityAggregateResult): boolean {
  return result.corpus.mentionCount >= MIN_ANALYSIS_SAMPLE;
}

// Re-export for UI label usage
export { fixedCountryName };