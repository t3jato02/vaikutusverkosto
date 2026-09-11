import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedGet, authedJson, apiError } from "@/lib/vaikuta/http";
import { createDraftCampaign } from "@/lib/vaikuta/campaigns";

// GET /api/vaikuta/campaigns — the current user's campaigns.
export async function GET(req: Request) {
  const auth = await authedGet(req);
  if (!auth.ok) return auth.res;
  const campaigns = await db.influenceCampaign.findMany({
    where: { userId: auth.ctx.userId },
    include: {
      decision: { select: { id: true, title: true, institutionEntity: { select: { canonicalName: true } } } },
      _count: { select: { recipients: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      decisionId: c.decisionId,
      decisionTitle: c.decision.title,
      institutionName: c.decision.institutionEntity?.canonicalName ?? null,
      title: c.title,
      status: c.status,
      paymentStatus: c.paymentStatus,
      deliveryStatus: c.deliveryStatus,
      planCode: c.planCode,
      recipientCount: c._count.recipients,
      publicVisibility: c.publicVisibility,
      isDemo: c.isDemo,
      abuseFlagged: c.abuseFlaggedAt !== null,
      suspended: c.status === "SUSPENDED",
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

interface CreateBody {
  decisionId?: string;
  title?: string;
  planCode?: string;
}

// POST /api/vaikuta/campaigns — start a new campaign for a decision.
export async function POST(req: Request) {
  const auth = await authedJson<CreateBody>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;
  if (!ctx.emailVerified) return apiError(403, "email_not_verified");

  const decisionId = String(ctx.body?.decisionId ?? "").trim();
  const decision = await db.decision.findUnique({ where: { id: decisionId }, select: { id: true, title: true } });
  if (!decision) return apiError(404, "decision_not_found");

  try {
    const campaign = await createDraftCampaign(ctx.userId, decisionId, {
      title: String(ctx.body?.title ?? decision.title ?? "Kampanja"),
      planCode: String(ctx.body?.planCode ?? "VAIKUTA_PASS"),
    });
    return NextResponse.json({ ok: true, campaignId: campaign.id }, { status: 201 });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return apiError(err.status ?? 400, err.code ?? err.message ?? "campaign_create_failed");
  }
}