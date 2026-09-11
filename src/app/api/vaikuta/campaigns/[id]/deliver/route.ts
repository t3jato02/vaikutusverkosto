import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { simulateDelivery } from "@/lib/vaikuta/campaigns";

// POST /api/vaikuta/campaigns/[id]/deliver — simulate delivery. Real delivery
// is impossible today: the MockDeliveryProvider never sends anything.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<null>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");

  try {
    const receipt = await simulateDelivery({
      userId: ctx.userId,
      campaign: { id: campaign.id, userId: campaign.userId, paymentStatus: campaign.paymentStatus, status: campaign.status },
    });
    return NextResponse.json({ ok: true, receipt });
  } catch (e) {
    const err = e as Error & { status?: number };
    return apiError(err.status ?? 400, err.message ?? "delivery_failed");
  }
}