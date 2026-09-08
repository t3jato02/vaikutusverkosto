// Reverse-case comparison (luvut 4, 12) — paired comparison of the two
// opposite migration directions:
//   A: foreign-born → Finland (inbound)
//   B: Finland-born → abroad (outbound)
//
// The matcher pairs the most similar persons across the two cohorts (age
// decade, public role, citizenship multiplicity, residence-tenure bucket) and
// then compares the framing the Finnish-media corpus attached to them
// (proportion labelled "suomalainen"). It reports sample sizes, Wilson
// intervals, Cohen's h, matching quality and missing-data rate. With a small
// sample the status is INSUFFICIENT_SAMPLE and NO effect size is claimed.

import type { BirthOriginFact, CitizenshipFact, ResidenceFact } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { cohensH, cohensHSigma, proportionReport, ageBucket, wilsonInterval } from "./stats";
import { MIN_ANALYSIS_SAMPLE, INSUFFICIENT_SAMPLE } from "./safety";

export const REVERSE_ALGORITHM_VERSION = "reverse_case_v1";

export interface ReversePersonProfile {
  personEntityId: string;
  name: string;
  birthCountry: string | null;
  birthYear: number | null;
  citizenships: string[];
  citizenshipCount: number;
  residenceCountry: string | null;
  residenceTenureBucket: number | null; // 0 | 1 | 2 | null (years in host)
  hasPublicRole: boolean;
  mentionCount: number;
  suomalainenMentions: number;
  hostEthnonymMentions: number;
}

export interface ReverseComparisonResult {
  directionA: string;
  directionB: string;
  algorithmVersion: string;
  status: "COMPLETED" | "INSUFFICIENT_SAMPLE" | "ERROR";
  sampleSizeA: number;
  sampleSizeB: number;
  matchedPairs: number;
  matchingQuality: number;
  missingDataRate: number;
  outcome: {
    metric: string;
    proportionA: { successes: number; n: number; p: number; low: number; high: number };
    proportionB: { successes: number; n: number; p: number; low: number; high: number };
    cohensH: number | null;
    cohensHCI: { low: number; high: number } | null;
  } | null;
  confounders: string[];
  limitations: string[];
  matchedRows: { a: string; b: string; score: number }[];
}

interface FactBundle {
  birthCountry: BirthOriginFact | null;
  citizenships: CitizenshipFact[];
  residences: ResidenceFact[];
}

const HOST_ETHNONYM_BY_COUNTRY: Record<string, string[]> = {
  US: ["amerikkalainen", "yhdysvaltalainen"],
  SE: ["ruotsalainen"],
  GB: ["brittiläinen"],
  DE: ["saksalainen"],
  FR: ["ranskalainen"],
  RU: ["venäläinen"],
  NO: ["norjalainen"],
  DK: ["tanskalainen"],
  CN: ["kiinalainen"],
};

export function isInbound(f: FactBundle): boolean {
  if (!f.birthCountry || f.birthCountry.value === "FI") return false;
  const hasFI = f.citizenships.some((c) => c.countryCode === "FI" && c.status === "CURRENT");
  const curRes = f.residences.find((r) => r.isCurrent);
  const livesInFI = curRes?.countryCode === "FI";
  return hasFI || livesInFI;
}

export function isOutbound(f: FactBundle): boolean {
  if (!f.birthCountry || f.birthCountry.value !== "FI") return false;
  const hasForeignCitizenship = f.citizenships.some((c) => c.countryCode !== "FI" && c.status === "CURRENT");
  const curRes = f.residences.find((r) => r.isCurrent);
  const livesAbroad = curRes != null && curRes.countryCode !== "FI";
  return hasForeignCitizenship || livesAbroad;
}

function tenureBucket(f: FactBundle): number | null {
  const res = f.residences.find((r) => r.isCurrent);
  if (!res || !res.startDate) return null;
  const years = new Date().getFullYear() - res.startDate.getFullYear();
  if (years < 10) return 0;
  if (years < 20) return 1;
  return 2;
}

export async function computeReverseComparison(): Promise<ReverseComparisonResult> {
  const [birthFacts, citizenshipFacts, residenceFacts] = await Promise.all([
    db.birthOriginFact.findMany({ where: { reviewStatus: "PUBLISHED", factKind: "BIRTH_COUNTRY" } }),
    db.citizenshipFact.findMany({ where: { reviewStatus: "PUBLISHED" } }),
    db.residenceFact.findMany({ where: { reviewStatus: "PUBLISHED" } }),
  ]);

  const personIds = [
    ...new Set([
      ...birthFacts.map((b) => b.personEntityId),
      ...citizenshipFacts.map((c) => c.personEntityId),
      ...residenceFacts.map((r) => r.personEntityId),
    ]),
  ];
  const [entities, roleGroups, mentions] = await Promise.all([
    db.entity.findMany({
      where: { id: { in: personIds }, type: "PERSON" },
      select: { id: true, canonicalName: true, person: { select: { birthYear: true } } },
    }),
    db.position.groupBy({ by: ["personEntityId"], where: { personEntityId: { in: personIds }, isCurrent: true }, _count: { _all: true } }),
    db.mediaIdentityMention.findMany({
      where: { reviewStatus: "PUBLISHED" },
      select: { personEntityId: true, expressionNormalized: true, termCategory: true },
    }),
  ]);

  const roleSet = new Set(roleGroups.map((r) => r.personEntityId));
  const mentionByPerson = new Map<string, { total: number; suomalainen: number; host: number }>();
  for (const m of mentions) {
    const cur = mentionByPerson.get(m.personEntityId) ?? { total: 0, suomalainen: 0, host: 0 };
    cur.total += 1;
    const norm = m.expressionNormalized;
    if (norm.includes("suomalainen") || norm === "suomalaisen" || norm === "suomalaista" || norm === "suomalaisia" || norm === "suomalaisten") {
      cur.suomalainen += 1;
    }
    for (const forms of Object.values(HOST_ETHNONYM_BY_COUNTRY)) {
      if (forms.some((f) => norm.includes(f))) {
        cur.host += 1;
        break;
      }
    }
    mentionByPerson.set(m.personEntityId, cur);
  }

  const facts = new Map<string, FactBundle>();
  for (const id of personIds) facts.set(id, { birthCountry: null, citizenships: [], residences: [] });
  for (const b of birthFacts) {
    const cur = facts.get(b.personEntityId);
    if (cur && !cur.birthCountry) cur.birthCountry = b;
  }
  for (const c of citizenshipFacts) facts.get(c.personEntityId)?.citizenships.push(c);
  for (const r of residenceFacts) facts.get(r.personEntityId)?.residences.push(r);

  const profileOf = (e: { id: string; canonicalName: string; person: { birthYear: number | null } | null }): ReversePersonProfile | null => {
    const f = facts.get(e.id);
    if (!f) return null;
    const curRes = f.residences.find((r) => r.isCurrent);
    const host = isInbound(f) ? "FI" : isOutbound(f) ? "abroad" : null;
    const mentions = mentionByPerson.get(e.id);
    return {
      personEntityId: e.id,
      name: e.canonicalName,
      birthCountry: f.birthCountry?.value ?? null,
      birthYear: e.person?.birthYear ?? null,
      citizenships: f.citizenships.filter((c) => c.status === "CURRENT").map((c) => c.countryCode),
      citizenshipCount: f.citizenships.filter((c) => c.status === "CURRENT").length,
      residenceCountry: curRes?.countryCode ?? null,
      residenceTenureBucket: host ? tenureBucket(f) : null,
      hasPublicRole: roleSet.has(e.id),
      mentionCount: mentions?.total ?? 0,
      suomalainenMentions: mentions?.suomalainen ?? 0,
      hostEthnonymMentions: mentions?.host ?? 0,
    };
  };

  const cohortA: ReversePersonProfile[] = [];
  const cohortB: ReversePersonProfile[] = [];
  for (const e of entities) {
    const p = profileOf(e);
    if (!p) continue;
    if (isInbound(facts.get(e.id)!)) cohortA.push(p);
    else if (isOutbound(facts.get(e.id)!)) cohortB.push(p);
  }

  const missingA = cohortA.filter((p) => p.birthYear === null || p.residenceTenureBucket === null).length;
  const missingB = cohortB.filter((p) => p.birthYear === null || p.residenceTenureBucket === null).length;
  const missingDataRate = cohortA.length + cohortB.length > 0 ? (missingA + missingB) / (cohortA.length + cohortB.length) : 0;

  // Greedy best-score matching (each person used once).
  const matched = matchCohorts(cohortA, cohortB);

  const base: ReverseComparisonResult = {
    directionA: "inbound_foreign_to_fi",
    directionB: "outbound_fi_to_foreign",
    algorithmVersion: REVERSE_ALGORITHM_VERSION,
    status: "COMPLETED",
    sampleSizeA: cohortA.length,
    sampleSizeB: cohortB.length,
    matchedPairs: matched.length,
    matchingQuality: Math.min(cohortA.length, cohortB.length) > 0 ? matched.length / Math.min(cohortA.length, cohortB.length) : 0,
    missingDataRate,
    outcome: null,
    confounders: [
      "Ikäryhmä (syntymävuosikymmen)",
      "Julkinen rooli (dokumentoitu tehtävä)",
      "Kansalaisuuksien lukumäärä",
      "Asumisen kesto kohdemaassa",
      "Uutisgenre / tapahtumatyyppi: ei saatavissa korpuksesta",
    ],
    limitations: [
      "Vertailu perustuu analysoituun suomenkieliseen korpukseen; se ei mittaa kohdemaan mediaa.",
      "Pienellä otoksella ei väitetä efektiä (INSUFFICIENT_SAMPLE).",
      "Media-ilmaukset ovat havaittua sanastoa, eivät näyttöä puolueellisuudesta.",
    ],
    matchedRows: matched.map((m) => ({ a: m.a.personEntityId, b: m.b.personEntityId, score: m.score })),
  };

  if (!sampleSufficient(cohortA.length) || !sampleSufficient(cohortB.length) || matched.length < MIN_ANALYSIS_SAMPLE) {
    return { ...base, status: INSUFFICIENT_SAMPLE };
  }

  // Outcome: proportion of persons the corpus labelled "suomalainen".
  const inMatchedA = new Set(matched.map((m) => m.a.personEntityId));
  const inMatchedB = new Set(matched.map((m) => m.b.personEntityId));
  const aLabelled = cohortA.filter((p) => inMatchedA.has(p.personEntityId) && p.suomalainenMentions > 0).length;
  const bLabelled = cohortB.filter((p) => inMatchedB.has(p.personEntityId) && p.suomalainenMentions > 0).length;
  const nA = inMatchedA.size;
  const nB = inMatchedB.size;

  const pa = proportionReport(aLabelled, nA);
  const pb = proportionReport(bLabelled, nB);
  const h = cohensH(pa.p, pb.p);
  const sigma = cohensHSigma(nA, nB);

  return {
    ...base,
    outcome: {
      metric: "osuus, joita korpus kutsuu 'suomalaiseksi' (NATIONALITY-ilmaus)",
      proportionA: pa,
      proportionB: pb,
      cohensH: h,
      cohensHCI: { low: h - 1.96 * sigma, high: h + 1.96 * sigma },
    },
  };
}

function sampleSufficient(n: number): boolean {
  return n >= MIN_ANALYSIS_SAMPLE;
}

function matchScore(a: ReversePersonProfile, b: ReversePersonProfile): number {
  let score = 0;
  if (a.birthYear !== null && b.birthYear !== null && ageBucket(a.birthYear) === ageBucket(b.birthYear)) score += 2;
  if (a.hasPublicRole === b.hasPublicRole) score += 1;
  if (a.citizenshipCount === b.citizenshipCount) score += 1;
  if (a.residenceTenureBucket !== null && b.residenceTenureBucket !== null && a.residenceTenureBucket === b.residenceTenureBucket) score += 1;
  else if (a.residenceTenureBucket === null && b.residenceTenureBucket === null) score += 1;
  return score;
}

export function matchCohorts(
  a: ReversePersonProfile[],
  b: ReversePersonProfile[],
): { a: ReversePersonProfile; b: ReversePersonProfile; score: number }[] {
  const usedB = new Set<string>();
  const pairs: { a: ReversePersonProfile; b: ReversePersonProfile; score: number }[] = [];
  for (const pa of a) {
    let best: { b: ReversePersonProfile; score: number } | null = null;
    for (const pb of b) {
      if (usedB.has(pb.personEntityId)) continue;
      const score = matchScore(pa, pb);
      if (score >= 2 && (!best || score > best.score)) best = { b: pb, score };
    }
    if (best) {
      usedB.add(best.b.personEntityId);
      pairs.push({ a: pa, b: best.b, score: best.score });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

/** Compute and persist the comparison snapshot (upsert by direction). */
export async function computeAndStoreReverseComparison(): Promise<ReverseComparisonResult> {
  const result = await computeReverseComparison();
  const specHash = createHash("sha256")
    .update([result.directionA, result.directionB, REVERSE_ALGORITHM_VERSION].join("|"))
    .digest("hex");
  await db.identityComparison.upsert({
    where: { specHash },
    create: {
      direction: result.directionA,
      specHash,
      algorithmVersion: REVERSE_ALGORITHM_VERSION,
      sampleSizeA: result.sampleSizeA,
      sampleSizeB: result.sampleSizeB,
      matchedPairs: result.matchedPairs,
      status: result.status,
      effectSize: result.outcome?.cohensH ?? null,
      effectSizeType: result.outcome ? "cohens_h" : null,
      confidenceInterval: (result.outcome ? result.outcome.cohensHCI : null) as never,
      missingDataRate: result.missingDataRate,
      matchingQuality: result.matchingQuality,
      confounders: result.confounders as never,
      result: result as never,
    },
    update: {
      sampleSizeA: result.sampleSizeA,
      sampleSizeB: result.sampleSizeB,
      matchedPairs: result.matchedPairs,
      status: result.status,
      effectSize: result.outcome?.cohensH ?? null,
      effectSizeType: result.outcome ? "cohens_h" : null,
      confidenceInterval: (result.outcome ? result.outcome.cohensHCI : null) as never,
      missingDataRate: result.missingDataRate,
      matchingQuality: result.matchingQuality,
      result: result as never,
    },
  });
  return result;
}

// Re-export for tests
export { wilsonInterval };