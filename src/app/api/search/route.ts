import { NextResponse } from "next/server";
import { searchEntities, searchMoney } from "@/lib/queries";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = rateLimit(clientIp(req), Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 120));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const n = Math.min(Number(searchParams.get("limit") ?? 8), 25);
  const [results, money] = await Promise.all([searchEntities(q, n), searchMoney(q, 5)]);
  const moneyResults = money.map((m) => ({
    id: m.id,
    canonicalName: `${m.payerEntity.canonicalName} → ${m.recipientEntity.canonicalName}`,
    type: "MONEY",
    label: "RAHA",
    url: `/money#flow-${m.id}`,
    subtitle: m.purpose ?? m.flowType,
    sourceCount: m.sourceCount,
  }));
  return NextResponse.json({ results: [...results, ...moneyResults] });
}