import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveShortId } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { publicVisibleWhere } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const { id } = await params;
  const entityId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  if (!entityId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const relationships = await db.relationship.findMany({
    where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }], ...publicVisibleWhere },
    include: {
      sourceEntity: { select: { id: true, canonicalName: true, type: true } },
      targetEntity: { select: { id: true, canonicalName: true, type: true } },
      evidence: { include: { source: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ relationships });
}