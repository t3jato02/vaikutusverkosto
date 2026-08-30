import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveShortId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entityId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  if (!entityId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const relationships = await db.relationship.findMany({
    where: { OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }] },
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