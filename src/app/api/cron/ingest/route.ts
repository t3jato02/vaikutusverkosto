// Cron orchestrator — runs *due* ingestion sources (cadence from the Source
// Registry). Protected by middleware (CRON_SECRET bearer or admin session).
//   Vercel Cron:          GET  /api/cron/ingest
//   Manual admin trigger: POST /api/cron/ingest { agents?: ["parliament-agent", ...] }
//
// Bounded execution: at most MAX_SOURCES_PER_TICK sources per invocation, each
// with a per-source document budget; runs are resumable across ticks.

import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/pipeline";
import { getAdapter } from "@/lib/agents/registry";
import { syncRegistry } from "@/lib/agents/sourceRegistry";
import { dueSources, runOptionsFor } from "@/lib/agents/scheduler";

export const dynamic = "force-dynamic";
// Heavy adapters (EU FTS: two ~20 MB XLSX downloads + stream parse in `discover`)
// need more than the old 120 s. 300 s is the Vercel ceiling on the current plan;
// per-source work is still chunked (`maxDocsPerTick`) and resumable across ticks.
export const maxDuration = 300;

export async function GET() {
  return runTick();
}

export async function POST(req: Request) {
  let agents: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.agents)) agents = body.agents.map(String);
  } catch {
    // fall through: run due sources
  }
  return runTick(agents);
}

async function runTick(only?: string[] | null) {
  const results: Record<string, unknown> = {};
  // Keep the Source Registry in step with the code adapters first.
  await syncRegistry().catch((e) => console.error("registry sync failed", e));

  // Manual trigger runs exactly what was asked; cron runs what the scheduler
  // says is due (cadence + enabled + resumable-in-progress).
  const targets = only && only.length ? only : await dueSources();

  for (const id of targets) {
    const adapter = getAdapter(id);
    if (!adapter) {
      results[id] = { error: "unknown source" };
      continue;
    }
    const opts = runOptionsFor(id);
    try {
      results[id] = await runAgent(adapter, { ...opts, resume: true });
    } catch (e) {
      results[id] = { error: (e as Error).message };
    }
  }

  if (Object.keys(results).length === 0) results["_"] = { note: "no sources due this tick" };
  return NextResponse.json({ tick: new Date().toISOString(), results });
}
