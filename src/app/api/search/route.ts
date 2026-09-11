import { NextResponse } from "next/server";
import { searchEntities, searchMoney, searchProjects, projectUrlFor } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const n = Math.min(Number(searchParams.get("limit") ?? 8), 25);
  const [results, money, projects] = await Promise.all([
    searchEntities(q, n),
    searchMoney(q, 5),
    searchProjects(q, 5),
  ]);
  const moneyResults = money.map((m) => ({
    id: m.id,
    canonicalName: `${m.payerEntity.canonicalName} → ${m.recipientEntity.canonicalName}`,
    type: "MONEY",
    label: "RAHA",
    url: `/money#flow-${m.id}`,
    subtitle: m.purpose ?? m.flowType,
    sourceCount: m.sourceCount,
  }));
  const projectResults = projects.map((p) => ({
    id: p.id,
    canonicalName: p.name,
    type: "PROJECT",
    label: "HANKE",
    url: projectUrlFor(p.id, p.name),
    subtitle: [p.programme, p.flows[0]?.recipientEntity?.canonicalName].filter(Boolean).join(" · "),
    sourceCount: 0,
  }));
  return NextResponse.json({ results: [...results, ...projectResults, ...moneyResults] });
}