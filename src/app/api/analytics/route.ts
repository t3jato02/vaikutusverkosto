import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { networkAnalytics, type GraphScope, type Temporal } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const SCOPES: GraphScope[] = ["organisational", "funding", "decision", "ownership", "international"];
const TEMPORAL: Temporal[] = ["current", "historical", "all"];

// GET /api/analytics?scope=funding&temporal=current&country=&fromYear=&toYear=
export async function GET(req: Request) {
  const rl = await rateLimit(req, "expensive"); // Brandes is O(V*E) on a cold cache.
  if (!rl.allowed) return tooManyRequests(rl);

  const sp = new URL(req.url).searchParams;
  const scope = (sp.get("scope") ?? "funding") as GraphScope;
  const temporal = (sp.get("temporal") ?? "current") as Temporal;
  if (!SCOPES.includes(scope)) return NextResponse.json({ error: "bad_scope", scopes: SCOPES }, { status: 400 });
  if (!TEMPORAL.includes(temporal)) return NextResponse.json({ error: "bad_temporal" }, { status: 400 });

  const result = await networkAnalytics(scope, temporal, {
    country: sp.get("country") ?? undefined,
    fromYear: sp.get("fromYear") ? Number(sp.get("fromYear")) : undefined,
    toYear: sp.get("toYear") ? Number(sp.get("toYear")) : undefined,
    verifiedOnly: sp.get("verifiedOnly") !== "false",
  });
  return NextResponse.json(result);
}
