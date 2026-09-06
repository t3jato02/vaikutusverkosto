// Foreign funding / international connections (Sprint C).
//
// NEUTRALITY: the same evidence standard applies to every country and every
// organisation type. A person's nationality, ethnicity, religion or country of
// birth is never, on its own, an influence edge or a risk signal. What counts
// is a documented flow / ownership / role / contract / decision, with evidence.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { publicVisibleWhere } from "@/lib/verification";

export const HOME_COUNTRY = "FI";

/** A flow is "foreign" when a funder country is known and it is not Finland. */
export function deriveIsForeign(funderCountryCode: string | null | undefined): boolean {
  return Boolean(funderCountryCode) && funderCountryCode!.toUpperCase() !== HOME_COUNTRY;
}

export interface ForeignFundingFilters {
  country?: string; // funder ISO2
  region?: string;
  funderEntityId?: string;
  recipientEntityId?: string;
  projectId?: string;
  fundingType?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  from?: Date;
  to?: Date;
  temporal?: "current" | "historical" | "all";
  verifiedOnly?: boolean; // default true
  foreignOnly?: boolean; // default true
}

export function buildForeignFundingWhere(f: ForeignFundingFilters): Prisma.FinancialFlowWhereInput {
  const where: Prisma.FinancialFlowWhereInput = { ...publicVisibleWhere };
  if (f.foreignOnly !== false) where.isForeign = true;
  if (f.verifiedOnly !== false) where.verificationStatus = { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] };
  if (f.country) where.funderCountryCode = f.country.toUpperCase();
  if (f.funderEntityId) where.payerEntityId = f.funderEntityId;
  if (f.recipientEntityId) where.recipientEntityId = f.recipientEntityId;
  if (f.projectId) where.projectId = f.projectId;
  if (f.fundingType) where.fundingType = f.fundingType as Prisma.FinancialFlowWhereInput["fundingType"];
  if (f.currency) where.currency = f.currency;
  if (f.minAmount != null || f.maxAmount != null) {
    where.amount = {};
    if (f.minAmount != null) (where.amount as Prisma.DecimalFilter).gte = f.minAmount;
    if (f.maxAmount != null) (where.amount as Prisma.DecimalFilter).lte = f.maxAmount;
  }
  if (f.from || f.to) {
    where.flowDate = {};
    if (f.from) (where.flowDate as Prisma.DateTimeNullableFilter).gte = f.from;
    if (f.to) (where.flowDate as Prisma.DateTimeNullableFilter).lte = f.to;
  }
  return where;
}

export interface FundingGraph {
  nodes: { id: string; label: string; kind: string; country?: string | null; amount?: number }[];
  edges: { id: string; source: string; target: string; amount: number; currency: string; fundingType: string | null; year: number | null; verification: string; sourceCount: number; flowId: string }[];
  truncated: boolean;
}

/**
 * Bounded funding graph: Country → Funder → (Intermediary) → Recipient → Project.
 * Never returns the whole database — capped by `limit` flows.
 */
export async function foreignFundingGraph(f: ForeignFundingFilters & { limit?: number } = {}): Promise<FundingGraph> {
  const where = buildForeignFundingWhere(f);
  const limit = Math.min(Math.max(f.limit ?? 100, 1), 250);
  const flows = await db.financialFlow.findMany({
    where,
    orderBy: { amount: "desc" },
    take: limit + 1,
    include: {
      payerEntity: { select: { id: true, canonicalName: true, type: true, entityCategory: true, countryCode: true } },
      recipientEntity: { select: { id: true, canonicalName: true, type: true, entityCategory: true, countryCode: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const truncated = flows.length > limit;
  const use = truncated ? flows.slice(0, limit) : flows;

  const nodes = new Map<string, FundingGraph["nodes"][number]>();
  const add = (id: string, label: string, kind: string, country?: string | null) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, kind, country });
  };
  const edges: FundingGraph["edges"] = [];
  for (const fl of use) {
    const country = fl.funderCountryCode ?? "??";
    add(`country:${country}`, country, "country", country);
    add(`e:${fl.payerEntity.id}`, fl.payerEntity.canonicalName, "funder", fl.payerEntity.countryCode);
    add(`e:${fl.recipientEntity.id}`, fl.recipientEntity.canonicalName, "recipient", fl.recipientEntity.countryCode);
    // country → funder (structural)
    edges.push({
      id: `cf:${country}:${fl.payerEntity.id}`,
      source: `country:${country}`,
      target: `e:${fl.payerEntity.id}`,
      amount: 0,
      currency: fl.currency,
      fundingType: null,
      year: null,
      verification: "structural",
      sourceCount: 0,
      flowId: "",
    });
    const target = `e:${fl.recipientEntity.id}`;
    if (fl.project) {
      add(`p:${fl.project.id}`, fl.project.name, "project", "FI");
      edges.push({
        id: `rp:${fl.recipientEntity.id}:${fl.project.id}`,
        source: `e:${fl.recipientEntity.id}`,
        target: `p:${fl.project.id}`,
        amount: 0,
        currency: fl.currency,
        fundingType: null,
        year: null,
        verification: "structural",
        sourceCount: 0,
        flowId: "",
      });
    }
    if (fl.intermediaryEntityId) {
      add(`e:${fl.intermediaryEntityId}`, "välittäjä", "intermediary");
      // Two documented steps, never one synthesised "A → C".
      edges.push({ id: `f1:${fl.id}`, source: `e:${fl.payerEntity.id}`, target: `e:${fl.intermediaryEntityId}`, amount: Number(fl.amount), currency: fl.currency, fundingType: fl.fundingType, year: fl.periodYear, verification: fl.verificationStatus, sourceCount: fl.sourceCount, flowId: fl.id });
      edges.push({ id: `f2:${fl.id}`, source: `e:${fl.intermediaryEntityId}`, target, amount: Number(fl.amount), currency: fl.currency, fundingType: fl.fundingType, year: fl.periodYear, verification: fl.verificationStatus, sourceCount: fl.sourceCount, flowId: fl.id });
    } else {
      edges.push({ id: `f:${fl.id}`, source: `e:${fl.payerEntity.id}`, target, amount: Number(fl.amount), currency: fl.currency, fundingType: fl.fundingType, year: fl.periodYear, verification: fl.verificationStatus, sourceCount: fl.sourceCount, flowId: fl.id });
    }
  }
  return { nodes: [...nodes.values()], edges, truncated };
}

export async function foreignFundingOverview(f: ForeignFundingFilters = {}) {
  const where = buildForeignFundingWhere(f);
  const [total, byCountry, byType, byYearRaw, topRecipients, countries] = await Promise.all([
    db.financialFlow.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    db.financialFlow.groupBy({ by: ["funderCountryCode"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } } }),
    db.financialFlow.groupBy({ by: ["fundingType"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } } }),
    // Per-year totals straight from the data — reporting years only, never interpolated.
    db.financialFlow.groupBy({ by: ["periodYear"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { periodYear: "asc" } }),
    db.financialFlow.groupBy({ by: ["recipientEntityId"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 }),
    db.country.findMany({ orderBy: { name: "asc" } }),
  ]);
  const byYear = byYearRaw
    .filter((y) => y.periodYear != null)
    .map((y) => ({ year: y.periodYear as number, amount: Number(y._sum.amount ?? 0), flowCount: y._count._all }));
  const recipientEntities = topRecipients.length
    ? await db.entity.findMany({
        where: { id: { in: topRecipients.map((r) => r.recipientEntityId) } },
        select: { id: true, canonicalName: true, type: true, entityCategory: true },
      })
    : [];
  return {
    totalAmount: Number(total._sum.amount ?? 0),
    flowCount: total._count._all,
    countryCount: byCountry.filter((c) => c.funderCountryCode).length,
    byCountry,
    byType,
    byYear,
    topRecipients,
    recipientEntities,
    countries,
  };
}
