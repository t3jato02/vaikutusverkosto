import { NextResponse } from "next/server";
import { getEntityGraph, resolveShortId } from "@/lib/queries";
import { relationshipLabel, flowLabel } from "@/lib/constants";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import type { RelationshipType, FlowType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const { id } = await params;
  const entityId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  if (!entityId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const depth = Math.min(Number(searchParams.get("depth") ?? 1), 4);
  const includeFlows = searchParams.get("flows") !== "false";
  const maxNodes = 240;

  const g = await getEntityGraph(entityId, { depth, includeFlows, maxNodes });

  const nodes = g.nodes.map((n) => ({
    id: n.id,
    label: n.canonicalName,
    type: n.type,
    subtype: n.subtype,
    sourceCount: n.sourceCount,
  }));

  const edgeTypes = new Set<string>();
  const edges: {
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
    role?: string | null;
    startDate: string | null;
    endDate: string | null;
    confidence: string;
    amount: number | null;
    flow: boolean;
    sourceUrl: string | null;
  }[] = g.relationships.map((r) => {
    edgeTypes.add(r.relationshipType);
    return {
      id: `r-${r.id}`,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      type: r.relationshipType as RelationshipType,
      label: relationshipLabel(r.relationshipType as RelationshipType),
      role: r.role,
      startDate: r.startDate?.toISOString() ?? null,
      endDate: r.endDate?.toISOString() ?? null,
      confidence: r.confidence,
      amount: r.amount ? Number(r.amount) : null,
      flow: false,
      sourceUrl: r.evidence[0]?.source?.sourceUrl ?? null,
    };
  });
  for (const f of g.flows) {
    edgeTypes.add(`FLOW:${f.flowType}`);
    edges.push({
      id: `f-${f.id}`,
      source: f.payerEntityId,
      target: f.recipientEntityId,
      type: `FLOW:${f.flowType}`,
      label: flowLabel(f.flowType as FlowType),
      startDate: f.flowDate?.toISOString() ?? f.periodStart?.toISOString() ?? null,
      endDate: f.periodEnd?.toISOString() ?? null,
      confidence: f.confidence,
      amount: Number(f.amount),
      flow: true,
      sourceUrl: f.evidence[0]?.source?.sourceUrl ?? null,
    });
  }

  return NextResponse.json({
    centerId: entityId,
    nodes,
    edges,
    edgeTypes: [...edgeTypes],
  });
}