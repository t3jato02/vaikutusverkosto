import { NextResponse } from "next/server";
import { getRecentChanges, getMoneyAggregates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "changes";
  if (kind === "money") {
    return NextResponse.json(await getMoneyAggregates());
  }
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);
  const changes = await getRecentChanges(limit);
  return NextResponse.json({
    changes: changes.map((c) => ({
      id: c.id,
      eventType: c.eventType,
      description: c.description,
      occurredAt: c.occurredAt,
      entityName: c.entity?.canonicalName ?? null,
      entityId: c.entity?.id ?? null,
      entityType: c.entity?.type ?? null,
    })),
  });
}