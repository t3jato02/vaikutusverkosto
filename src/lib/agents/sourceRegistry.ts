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

// International sources whose adapters are not built yet (Sprint C Phase 12).
// Registered DISABLED so they appear in the registry with a documented plan;
// the scheduler never runs a disabled source.
const PLANNED_SOURCES = [
  {
    id: "eu-fts",
    name: "EU Financial Transparency System",
    publisher: "European Commission — DG Budget",
    baseUrl: "https://ec.europa.eu/budget/financial-transparency-system/",
    sourceType: "OFFICIAL_REGISTER" as const,
    reliabilityTier: "OFFICIAL_REGISTER" as const,
    format: "PDF" as const, // annual XLSX/CSV downloads
    updateCadence: "monthly" as const,
    termsUrl: "https://ec.europa.eu/info/legal-notice_en",
    notes:
      "EU:n suorien avustusten ja hankintojen vuosiaineistot (XLSX/CSV). Adapteri vaatii " +
      "XLSX-jäsentimen + vuosikohtaisen latauksen. Ei vielä käytössä.",
  },
  {
    id: "eu-transparency-register",
    name: "EU Transparency Register",
    publisher: "European Parliament / European Commission",
    baseUrl: "https://ec.europa.eu/transparencyregister/public/",
    sourceType: "OFFICIAL_REGISTER" as const,
    reliabilityTier: "OFFICIAL_REGISTER" as const,
    format: "API" as const,
    updateCadence: "monthly" as const,
    termsUrl: "https://ec.europa.eu/transparencyregister/public/staticPage/displayStaticPage.do?locale=en&reference=WHY_TRANSPARENCY_REGISTER",
    notes:
      "EU:n avoimuusrekisteri (edunvalvojat, rahoitus, asiakkaat). JSON/CSV-vienti saatavilla. " +
      "Adapteri suunnitteilla. Ei vielä käytössä.",
  },
] as const;

/**
 * Upsert one registry row per registered adapter. Idempotent: descriptive
 * fields are refreshed from code; operational fields (enabled, health) are
 * preserved. Returns the number of rows seen.
 */
export async function syncRegistry(client: PrismaClient = db): Promise<number> {
  const adapters = listAdapters();
  for (const p of PLANNED_SOURCES) {
    await client.ingestionSource.upsert({
      where: { id: p.id },
      update: { name: p.name, publisher: p.publisher, baseUrl: p.baseUrl, notes: p.notes, termsUrl: p.termsUrl },
      create: { ...p, adapter: "", enabled: false },
    });
  }
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

export interface RegistryRunCounters {
  docsChecked?: number;
  docsChanged?: number;
  durationMs?: number;
}

export async function recordRegistryCheck(
  adapterId: string,
  result: { ok: boolean; error?: string | null } & RegistryRunCounters,
  client: PrismaClient = db,
) {
  const exists = await client.ingestionSource.findUnique({ where: { id: adapterId }, select: { id: true } });
  if (!exists) await ensureRegistrySource(adapterId, client);
  const now = new Date();
  const counters = {
    ...(result.docsChecked != null ? { lastRunDocsChecked: result.docsChecked } : {}),
    ...(result.docsChanged != null ? { lastRunDocsChanged: result.docsChanged } : {}),
    ...(result.durationMs != null ? { lastRunDurationMs: Math.round(result.durationMs) } : {}),
  };
  if (result.ok) {
    await client.ingestionSource.update({
      where: { id: adapterId },
      data: { lastCheckedAt: now, lastSuccessAt: now, consecutiveFailures: 0, lastError: null, ...counters },
    });
  } else {
    await client.ingestionSource.update({
      where: { id: adapterId },
      data: {
        lastCheckedAt: now,
        lastErrorAt: now,
        lastError: (result.error ?? "unknown error").slice(0, 2000),
        consecutiveFailures: { increment: 1 },
        ...counters,
      },
    });
  }
}

/** Registry health state derived from failure streak + enabled flag. */
export type SourceHealth = "HEALTHY" | "DEGRADED" | "FAILING" | "DISABLED";

export function sourceHealth(row: { enabled: boolean; consecutiveFailures: number }): SourceHealth {
  if (!row.enabled) return "DISABLED";
  if (row.consecutiveFailures >= 3) return "FAILING";
  if (row.consecutiveFailures > 0) return "DEGRADED";
  return "HEALTHY";
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
