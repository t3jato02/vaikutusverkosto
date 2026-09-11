import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { saveRecipients } from "@/lib/vaikuta/campaigns";

interface RecipientsBody {
  entityIds?: string[];
}

// POST /api/vaikuta/campaigns/[id]/recipients — save the selected recipients.
// Server validates that every id is in the source-backed eligible set and that
// the count respects the campaign's plan limit.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<RecipientsBody>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");

  try {
    const count = await saveRecipients({
      userId: ctx.userId,
      campaign: { id: campaign.id, userId: campaign.userId, planCode: campaign.planCode },
      entityIds: Array.isArray(ctx.body?.entityIds) ? ctx.body!.entityIds.filter((v) => typeof v === "string") : [],
      decisionId: campaign.decisionId,
    });
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return apiError(err.status ?? 400, err.code ?? err.message ?? "recipients_save_failed");
  }
}