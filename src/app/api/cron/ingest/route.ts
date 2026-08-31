// Cron orchestrator — runs due agents.
// Protected by middleware (CRON_SECRET bearer or admin session).
// Vercel Cron: GET /api/cron/ingest
// Manual admin trigger: POST /api/cron/ingest { agents?: ["parliament-agent", ...] }

import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/pipeline";
import { getAdapter, listAdapters } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // stay within Vercel Hobby limit; heavy work is chunked

export async function GET() {
  return runDue();
}

export async function POST(req: Request) {
  let agents: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.agents)) agents = body.agents.map(String);
  } catch {
    // fall through: run due agents
  }
  return runDue(agents);
}

async function runDue(only?: string[] | null) {
  const results: Record<string, unknown> = {};
  const wanted = only && only.length ? only : listAdapters().map((a) => a.id);
  for (const id of wanted) {
    const adapter = getAdapter(id);
    if (!adapter) {
      results[id] = { error: "unknown agent" };
      continue;
    }
    // For manual triggers, run everything requested; for cron, respect schedule by day.
    if (!only && adapter.schedule === "weekly" && new Date().getUTCDay() !== 1) {
      results[id] = { skipped: "weekly agents run on Mondays" };
      continue;
    }
    try {
      results[id] = await runAgent(adapter, { concurrency: adapter.id === "parliament-agent" ? 6 : 2 });
    } catch (e) {
      results[id] = { error: (e as Error).message };
    }
  }
  return NextResponse.json({ results });
}