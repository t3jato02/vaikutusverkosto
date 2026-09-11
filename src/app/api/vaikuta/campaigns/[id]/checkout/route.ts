import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { startCheckout } from "@/lib/vaikuta/campaigns";

// POST /api/vaikuta/campaigns/[id]/checkout — Start a checkout for the
// campaign. The amount and plan are derived server-side (never from the body).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<null>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");

  try {
    const base = new URL(req.url).origin || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const started = await startCheckout({
      userId: ctx.userId,
      campaign: { id: campaign.id, userId: campaign.userId, planCode: campaign.planCode, status: campaign.status },
      baseUrl: base,
    });
    return NextResponse.json({ ok: true, ...started });
  } catch (e) {
    const err = e as Error & { status?: number };
    return apiError(err.status ?? 400, err.message ?? "checkout_start_failed");
  }
}