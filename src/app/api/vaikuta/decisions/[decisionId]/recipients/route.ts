import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedGet } from "@/lib/vaikuta/http";
import { getEligibleForDecision } from "@/lib/vaikuta/campaigns";
import { groupRecipients } from "@/lib/vaikuta/relevance";
import { planConfig } from "@/lib/vaikuta/pricing";

// GET /api/vaikuta/decisions/[decisionId]/recipients — eligible, source-backed
// recipients for the wizard. Requires an authenticated + verified user.
export async function GET(req: Request, { params }: { params: Promise<{ decisionId: string }> }) {
  const auth = await authedGet(req);
  if (!auth.ok) return auth.res;
  if (!auth.ctx.emailVerified) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }
  const { decisionId } = await params;
  const decision = await db.decision.findUnique({ where: { id: decisionId }, select: { id: true } });
  if (!decision) return NextResponse.json({ error: "decision_not_found" }, { status: 404 });

  const candidates = await getEligibleForDecision(decisionId);
  const groups = groupRecipients(candidates);
  return NextResponse.json({
    candidates: candidates.map((c) => ({
      entityId: c.entityId,
      name: c.name,
      subtype: c.subtype,
      role: c.role,
      organizationName: c.organizationName,
      isMedia: c.isMedia,
      dimension: c.dimension,
      reasonText: c.reasonText,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      verifiedAt: c.verifiedAt,
      contactAvailability: c.contactAvailability,
    })),
    groups,
    planLimit: planConfig("VAIKUTA_PASS").recipientLimit,
  });
}