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

export async function foreignFundingOverview(f: ForeignFundingFilters = {}) {
  const where = buildForeignFundingWhere(f);
  const [total, byCountry, byType, topRecipients, countries] = await Promise.all([
    db.financialFlow.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    db.financialFlow.groupBy({ by: ["funderCountryCode"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } } }),
    db.financialFlow.groupBy({ by: ["fundingType"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } } }),
    db.financialFlow.groupBy({ by: ["recipientEntityId"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 }),
    db.country.findMany({ orderBy: { name: "asc" } }),
  ]);
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
    topRecipients,
    recipientEntities,
    countries,
  };
}
