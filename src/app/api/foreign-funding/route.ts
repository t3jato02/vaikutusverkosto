import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { buildForeignFundingWhere, foreignFundingOverview, type ForeignFundingFilters } from "@/lib/foreign";

export const dynamic = "force-dynamic";

// GET /api/foreign-funding — documented foreign funding flows + aggregates.
// Default: only public-visible + verified + foreign flows.
export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);

  const sp = new URL(req.url).searchParams;
  const num = (k: string) => (sp.get(k) != null ? Number(sp.get(k)) : undefined);
  const filters: ForeignFundingFilters = {
    country: sp.get("country") ?? undefined,
    funderEntityId: sp.get("funder") ?? undefined,
    recipientEntityId: sp.get("recipient") ?? undefined,
    projectId: sp.get("project") ?? undefined,
    fundingType: sp.get("fundingType") ?? undefined,
    currency: sp.get("currency") ?? undefined,
    minAmount: num("minAmount"),
    maxAmount: num("maxAmount"),
    from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
    to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
    verifiedOnly: sp.get("verifiedOnly") !== "false",
    foreignOnly: sp.get("foreignOnly") !== "false",
  };

  const view = sp.get("view") ?? "list";
  if (view === "overview") {
    return NextResponse.json(await foreignFundingOverview(filters));
  }
  if (view === "graph") {
    const { foreignFundingGraph } = await import("@/lib/foreign");
    return NextResponse.json(await foreignFundingGraph({ ...filters, limit: num("limit") ?? 100 }));
  }

  const page = Math.max(Number(sp.get("page") ?? 1), 1);
  const perPage = Math.min(Number(sp.get("per_page") ?? 50), 100);
  const where = buildForeignFundingWhere(filters);
  const [total, flows] = await Promise.all([
    db.financialFlow.count({ where }),
    db.financialFlow.findMany({
      where,
      orderBy: { amount: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        payerEntity: { select: { id: true, canonicalName: true, type: true, entityCategory: true, countryCode: true } },
        recipientEntity: { select: { id: true, canonicalName: true, type: true, entityCategory: true, countryCode: true } },
        project: { select: { id: true, name: true, municipality: true, locationCountry: true } },
        evidence: { include: { source: true }, take: 5 },
      },
    }),
  ]);

  return NextResponse.json({
    page,
    perPage,
    total,
    flows: flows.map((f) => ({
      id: f.id,
      amount: Number(f.amount),
      currency: f.currency,
      originalAmount: f.originalAmount != null ? Number(f.originalAmount) : null,
      originalCurrency: f.originalCurrency,
      fundingType: f.fundingType,
      flowType: f.flowType,
      flowDate: f.flowDate,
      periodStart: f.periodStart,
      periodEnd: f.periodEnd,
      funderCountryCode: f.funderCountryCode,
      recipientCountryCode: f.recipientCountryCode,
      isForeign: f.isForeign,
      purpose: f.purpose,
      verificationStatus: f.verificationStatus,
      confidenceScore: f.confidenceScore,
      payer: f.payerEntity,
      recipient: f.recipientEntity,
      intermediaryEntityId: f.intermediaryEntityId,
      project: f.project,
      evidence: f.evidence.map((e) => ({
        sourceUrl: e.source.sourceUrl,
        sourceName: e.source.sourceName,
        publisher: e.source.publisher,
        publicationDate: e.source.publicationDate,
        retrievedAt: e.source.retrievedAt,
        quotedFragment: e.quotedFragment,
      })),
    })),
  });
}
