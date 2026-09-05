import { NextResponse } from "next/server";
import { getEntityById, resolveShortId } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const { id } = await params;
  const fullId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  if (!fullId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const entity = await getEntityById(fullId);
  if (!entity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entity });
}