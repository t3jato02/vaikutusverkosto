// Source Registry (Sprint B) — the single, persisted list of ingestion sources.
// Rows are seeded/refreshed from the code adapters (src/lib/agents/*). This is
// distinct from `Source` (a per-document evidence record): one IngestionSource
// row per adapter, carrying operational state (enabled, last check, last error).

import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { listAdapters, getAdapter } from "./registry";
import type { SourceAdapter } from "./types";

function registryRowFromAdapter(a: SourceAdapter) {
  return {
    name: a.name,
    publisher: a.publisher,
    baseUrl: a.baseUrl,
    sourceType: a.sourceType,
    adapter: a.id,
    reliabilityTier: (a.reliabilityTier ?? "OFFICIAL_PRIMARY") as
      | "OFFICIAL_PRIMARY"
      | "OFFICIAL_REGISTER"
      | "PUBLIC_DISCLOSURE"
      | "ANNUAL_REPORT"
      | "REPUTABLE_MEDIA"
      | "OTHER",
    format: a.format ?? "API",
    updateCadence: a.updateCadence ?? a.schedule,
    termsUrl: a.termsUrl ?? null,
    notes: a.notes ?? null,
  };
}

/**
 * Upsert one registry row per registered adapter. Idempotent: descriptive
 * fields are refreshed from code; operational fields (enabled, health) are
 * preserved. Returns the number of rows seen.
 */
export async function syncRegistry(client: PrismaClient = db): Promise<number> {
  const adapters = listAdapters();
  for (const a of adapters) {
    const row = registryRowFromAdapter(a);
    await client.ingestionSource.upsert({
      where: { id: a.id },
      // Do NOT touch `enabled` or health fields on update.
      update: {
        name: row.name,
        publisher: row.publisher,
        baseUrl: row.baseUrl,
        sourceType: row.sourceType,
        adapter: row.adapter,
        reliabilityTier: row.reliabilityTier,
        format: row.format,
        updateCadence: row.updateCadence,
        termsUrl: row.termsUrl,
        notes: row.notes,
      },
      create: { id: a.id, ...row },
    });
  }
  return adapters.length;
}

/** Ensure a single registry row exists for an adapter (used by the pipeline). */
export async function ensureRegistrySource(adapterId: string, client: PrismaClient = db) {
  const a = getAdapter(adapterId);
  if (!a) return null;
  const row = registryRowFromAdapter(a);
  return client.ingestionSource.upsert({
    where: { id: a.id },
    update: {},
    create: { id: a.id, ...row },
  });
}

export async function recordRegistryCheck(
  adapterId: string,
  result: { ok: boolean; error?: string | null },
  client: PrismaClient = db,
) {
  const exists = await client.ingestionSource.findUnique({ where: { id: adapterId }, select: { id: true } });
  if (!exists) await ensureRegistrySource(adapterId, client);
  const now = new Date();
  if (result.ok) {
    await client.ingestionSource.update({
      where: { id: adapterId },
      data: { lastCheckedAt: now, lastSuccessAt: now, consecutiveFailures: 0, lastError: null },
    });
  } else {
    await client.ingestionSource.update({
      where: { id: adapterId },
      data: {
        lastCheckedAt: now,
        lastErrorAt: now,
        lastError: (result.error ?? "unknown error").slice(0, 2000),
        consecutiveFailures: { increment: 1 },
      },
    });
  }
}

/** Is this source allowed to run right now? */
export async function isSourceEnabled(adapterId: string, client: PrismaClient = db): Promise<boolean> {
  const row = await client.ingestionSource.findUnique({ where: { id: adapterId }, select: { enabled: true } });
  // Unknown source -> allow (first run seeds it); explicitly disabled -> block.
  return row ? row.enabled : true;
}

export async function listRegistry(client: PrismaClient = db) {
  return client.ingestionSource.findMany({ orderBy: [{ enabled: "desc" }, { id: "asc" }] });
}
