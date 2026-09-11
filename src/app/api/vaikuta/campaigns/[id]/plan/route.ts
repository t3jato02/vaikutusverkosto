import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { planConfig } from "@/lib/vaikuta/pricing";

interface PlanBody {
  planCode?: string;
}

// PATCH /api/vaikuta/campaigns/[id]/plan — change the intended execution plan.
// Validated server-side against the pricing config; the price is always
// re-derived from config, never from this payload.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<PlanBody>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");
  if (campaign.userId !== ctx.userId) return apiError(403, "forbidden");
  if (campaign.paymentStatus === "SUCCEEDED") return apiError(409, "already_paid");

  const code = String(ctx.body?.planCode ?? "");
  const allowed = ["FREE", "VAIKUTA_PASS", "VAIKUTA_PLUS", "VAIKUTA_PRO", "ORGANIZATION"];
  if (!allowed.includes(code)) return apiError(400, "invalid_plan");
  const cfg = planConfig(code);

  await db.$transaction(async (tx) => {
    await tx.influenceCampaign.update({
      where: { id: campaign.id },
      data: {
        planCode: code,
        planSnapshot: {
          code: cfg.code,
          name: cfg.name,
          priceMinor: cfg.priceMinor,
          currency: cfg.currency,
          recipientLimit: cfg.recipientLimit,
          campaignAllowance: cfg.campaignAllowance,
          billingPeriod: cfg.billingPeriod,
        },
      },
    });
    await tx.campaignEvent.create({ data: { campaignId: campaign.id, type: "message_updated", metadata: { planCode: code } } });
  });

  return NextResponse.json({ ok: true, planCode: code, recipientLimit: cfg.recipientLimit });
}