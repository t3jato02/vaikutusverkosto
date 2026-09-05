// Source scheduler (Phase 14). Cadence lives in the Source Registry, not in the
// cron route. Each cron tick runs a bounded number of *due* sources; the rest
// wait for the next tick. Individual runs are already resumable.

import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";

export const MAX_SOURCES_PER_TICK = 2;

const CADENCE_MAX_AGE_MS: Record<string, number> = {
  daily: 20 * 60 * 60 * 1000, // ~a day, with slack for cron jitter
  weekly: 6 * 24 * 60 * 60 * 1000,
  monthly: 27 * 24 * 60 * 60 * 1000,
};

export interface DueSource {
  id: string;
  updateCadence: string;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
}

function isDue(row: DueSource, now: number): boolean {
  const cadence = row.updateCadence.toLowerCase();
  if (cadence === "manual") return false;
  const maxAge = CADENCE_MAX_AGE_MS[cadence];
  if (maxAge === undefined) return true; // unknown cadence → treat as always due
  if (!row.lastCheckedAt) return true;
  return now - row.lastCheckedAt.getTime() >= maxAge;
}

/**
 * Enabled sources that are due now, oldest-checked first, capped at
 * MAX_SOURCES_PER_TICK. A RUNNING (paused) source is always included so its
 * resumable ticks keep progressing.
 */
export async function dueSources(
  now: Date = new Date(),
  client: PrismaClient = defaultDb,
): Promise<string[]> {
  const rows = await client.ingestionSource.findMany({
    where: { enabled: true },
    select: { id: true, updateCadence: true, lastCheckedAt: true, lastSuccessAt: true },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
  });

  const runningIds = new Set(
    (
      await client.agentRun.findMany({
        where: { status: "RUNNING" },
        select: { agent: true },
      })
    ).map((r) => r.agent),
  );

  const due = rows.filter((r) => runningIds.has(r.id) || isDue(r, now.getTime()));
  return due.slice(0, MAX_SOURCES_PER_TICK).map((r) => r.id);
}

/** Per-source run tuning. Conservative defaults keep each tick inside the budget. */
export function runOptionsFor(sourceId: string): { concurrency: number; maxDocsPerTick: number } {
  switch (sourceId) {
    case "parliament-agent":
      return { concurrency: 6, maxDocsPerTick: 25 };
    case "prh-agent":
      return { concurrency: 4, maxDocsPerTick: 15 };
    default:
      return { concurrency: 2, maxDocsPerTick: 2 };
  }
}
