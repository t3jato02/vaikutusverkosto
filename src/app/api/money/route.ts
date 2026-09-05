import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const byType = await db.financialFlow.groupBy({
    by: ["flowType"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });
  const byRecipient = await db.financialFlow.groupBy({
    by: ["recipientEntityId"],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });
  const recipients = byRecipient.length
    ? await db.entity.findMany({
        where: { id: { in: byRecipient.map((r) => r.recipientEntityId) } },
        select: { id: true, canonicalName: true, type: true },
      })
    : [];
  return NextResponse.json({ byType, byRecipient, recipients });
}