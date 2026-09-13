import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { financeInterlockReport } from "@/lib/institutionalPower/financeInterlocks";

export const dynamic = "force-dynamic";

// GET /api/institutional/finance/interlocks
// Board interlocks between finance institutions and the wider graph, with the
// underlying role sources. Each interlock is a structural fact backed by
// documented roles — never a collusion or corruption label.
export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);

  const report = await financeInterlockReport(db);
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}