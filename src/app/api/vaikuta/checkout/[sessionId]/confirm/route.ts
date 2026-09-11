import { NextResponse } from "next/server";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { confirmCheckout } from "@/lib/vaikuta/campaigns";

interface ConfirmBody {
  sessionId?: string;
}

// POST /api/vaikuta/checkout/[sessionId]/confirm — mock provider payment
// confirmation. The amount is re-derived server-side; no real charge happens.
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await authedJson<ConfirmBody>(req);
  if (!auth.ok) return auth.res;
  const { ctx } = auth;

  const { sessionId } = await params;
  try {
    const result = await confirmCheckout({ userId: ctx.userId, sessionId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = e as Error & { status?: number };
    return apiError(err.status ?? 400, err.message ?? "confirm_failed");
  }
}