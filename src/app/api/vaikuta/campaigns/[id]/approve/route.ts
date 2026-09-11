import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { approveMessage } from "@/lib/vaikuta/campaigns";

// POST /api/vaikuta/campaigns/[id]/approve — explicit user approval of the
// final text (Step 4). Nothing is sent anywhere without this step.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<null>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");

  try {
    await approveMessage({
      userId: ctx.userId,
      campaign: { id: campaign.id, userId: campaign.userId, status: campaign.status, messageBody: campaign.messageBody },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    return apiError(err.status ?? 400, err.message ?? "approve_failed");
  }
}