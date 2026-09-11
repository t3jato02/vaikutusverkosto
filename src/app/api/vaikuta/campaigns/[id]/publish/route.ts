import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { publicCampaignsEnabled } from "@/lib/vaikuta/flags";
import { addCampaignEvent } from "@/lib/vaikuta/campaigns";
import type { Prisma } from "@prisma/client";

interface PublishBody {
  publicStatement?: string;
}

// POST /api/vaikuta/campaigns/[id]/publish — optionally make a campaign public
// (default PRIVATE). Gated by VAIKUTA_PUBLIC_CAMPAIGNS (default off).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<PublishBody>(req);
  if (!auth.ok) return auth.res;
  if (!publicCampaignsEnabled()) return apiError(403, "public_campaigns_disabled");

  const { ctx } = auth;
  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");
  if (campaign.userId !== ctx.userId) return apiError(403, "forbidden");
  if (campaign.paymentStatus !== "SUCCEEDED") return apiError(403, "payment_required");

  const publicStatement = String(ctx.body?.publicStatement ?? "").trim().slice(0, 2000);
  if (publicStatement.length < 20) return apiError(400, "public_statement_too_short");

  await db.influenceCampaign.update({
    where: { id: campaign.id },
    data: { publicVisibility: "PUBLIC", publicStatement },
  });
  await addCampaignEvent(campaign.id, "campaign_closed", { published: true });
  // Analytics never stores message/sender content.
  await db.vaikutaEvent.create({
    data: {
      eventType: "campaign_published",
      userId: ctx.userId,
      campaignId: campaign.id,
      decisionId: campaign.decisionId,
      metadata: { isPublic: true } as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ ok: true, publicUrl: `/vaikuta/campaign/${campaign.id}/public` });
}