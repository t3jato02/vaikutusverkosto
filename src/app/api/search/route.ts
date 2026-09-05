import { NextResponse } from "next/server";
import { searchEntities, searchMoney } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
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