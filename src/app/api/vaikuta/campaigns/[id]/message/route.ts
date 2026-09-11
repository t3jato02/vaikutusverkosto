import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { saveMessage } from "@/lib/vaikuta/campaigns";

interface MessageBody {
  subject?: string;
  body?: string;
}

// POST /api/vaikuta/campaigns/[id]/message — save + validate the message.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedJson<MessageBody>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return apiError(404, "campaign_not_found");

  const result = await saveMessage({
    userId: ctx.userId,
    campaign: { id: campaign.id, userId: campaign.userId, status: campaign.status },
    subject: String(ctx.body?.subject ?? ""),
    body: String(ctx.body?.body ?? ""),
    decisionId: campaign.decisionId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ ok: true, requiresModeration: result.requiresModeration, flags: result.flags });
}