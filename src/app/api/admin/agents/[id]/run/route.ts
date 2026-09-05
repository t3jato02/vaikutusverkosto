import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/pipeline";
import { getAdapter } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adapter = getAdapter(id);
  if (!adapter) return NextResponse.json({ error: "unknown_agent" }, { status: 404 });
  // Admin triggers continue a paused run (resumable ticks) when one exists.
  const report = await runAgent(adapter, { resume: true });
  return NextResponse.json({ report });
}