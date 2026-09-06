import { NextResponse } from "next/server";
import { getRecentChanges, getMoneyAggregates } from "@/lib/queries";
import { changeEventSentence } from "@/lib/labels";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
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
      // Human sentence built from structured fields — never the stored
      // `description` (which historically embedded raw enum values).
      summary: changeEventSentence({
        eventType: c.eventType,
        entityName: c.subject?.canonicalName,
        counterpartName: c.counterpart?.canonicalName,
        relationshipType: c.relationship?.relationshipType ?? null,
        amountText: c.flow?.amount ? `${Number(c.flow.amount)} ${c.flow.currency ?? "EUR"}` : null,
      }),
      occurredAt: c.occurredAt,
      entityName: c.subject?.canonicalName ?? null,
      entityId: c.subject?.id ?? null,
      entityType: c.subject?.type ?? null,
      relationshipType: c.relationship?.relationshipType ?? null,
      counterpartName: c.counterpart?.canonicalName ?? null,
      counterpartId: c.counterpart?.id ?? null,
    })),
  });
}
