import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { getVaikutaFunnel } from "@/lib/vaikuta/events";
import { db } from "@/lib/db";

// GET /api/vaikuta/analytics — administrative funnel. Admin session only.
export async function GET() {
  if (!(await getSessionFromCookie())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const funnel = await getVaikutaFunnel();
  const [moderationQueue, suspended, delivered, mockCharges] = await Promise.all([
    db.influenceCampaign.count({ where: { status: "REQUIRES_MODERATION" } }),
    db.influenceCampaign.count({ where: { status: "SUSPENDED" } }),
    db.influenceCampaign.count({ where: { status: "DELIVERED" } }),
    db.vaikutaPayment.aggregate({ where: { status: "SUCCEEDED", isMock: true }, _count: { _all: true }, _sum: { amountMinor: true } }),
  ]);
  return NextResponse.json({
    funnel,
    moderationQueue,
    suspended,
    delivered,
    mockChargeCount: mockCharges._count._all,
    mockChargeTotalMinor: mockCharges._sum.amountMinor ?? 0,
    note: "Analytics contains no message contents.",
  });
}