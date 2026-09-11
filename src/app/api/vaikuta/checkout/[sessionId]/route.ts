import { NextResponse } from "next/server";
import { authedGet, apiError } from "@/lib/vaikuta/http";
import { db } from "@/lib/db";

// GET /api/vaikuta/checkout/[sessionId] — checkout session state for the mock
// pay page. Amount is the server-recorded one; the page displays it read-only.
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await authedGet(req);
  if (!auth.ok) return auth.res;

  const { sessionId } = await params;
  const session = await db.vaikutaCheckoutSession.findUnique({
    where: { id: sessionId },
    include: { campaign: { select: { id: true, title: true, messageSubject: true, planCode: true } } },
  });
  if (!session || session.userId !== auth.ctx.userId) return apiError(404, "checkout_session_not_found");

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      amountMinor: session.amountMinor,
      currency: session.currency,
      provider: session.provider,
      isMock: session.isMock,
      campaignId: session.campaignId,
      campaignTitle: session.campaign?.title ?? null,
      planCode: session.campaign?.planCode ?? null,
    },
  });
}