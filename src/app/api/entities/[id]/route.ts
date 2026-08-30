import { NextResponse } from "next/server";
import { getEntityById, resolveShortId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fullId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  if (!fullId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const entity = await getEntityById(fullId);
  if (!entity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entity });
}