import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

// Toggle an ingestion source's `enabled` flag. Admin-only (middleware).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "expensive");
  if (!rl.allowed) return tooManyRequests(rl);
  const { id } = await params;
  const row = await db.ingestionSource.findUnique({ where: { id }, select: { enabled: true } });
  if (!row) return NextResponse.json({ error: "unknown_source" }, { status: 404 });
  await db.ingestionSource.update({ where: { id }, data: { enabled: !row.enabled } });
  return NextResponse.redirect(new URL("/admin/agents", req.url), 303);
}
