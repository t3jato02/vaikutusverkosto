// Ingestion pipeline: discover → fetch → parse → publish (via verified publication service).
// Handles run-locking (no overlapping runs), AgentRun records, source health, retries.

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MAX_RUN_MINUTES, type RunContext, type RunReport, type SourceAdapter } from "./types";
import { TransientError, sleep } from "./http";
import { ensureSource, markSourceFailure, markSourceSuccess, publishVerifiedFact } from "./publish";
import { ensureRegistrySource, isSourceEnabled, recordRegistryCheck } from "./sourceRegistry";
import { collect, markDocumentProcessed } from "@/lib/ingestion/collector";
import type { DocumentDescriptor } from "@/lib/ingestion/types";

export interface RunOptions {
  concurrency?: number;
  /** Allow taking over a stale RUNNING run. */
  staleAfterMs?: number;
  /** Process at most this many documents per invocation, then pause (resumable). */
  maxDocsPerTick?: number;
  /** Continue a paused RUNNING run (same AgentRun row + cursor) instead of a new run. */
  resume?: boolean;
}

interface RunCursor {
  processed: string[];
}

/** Persist the resume cursor as Prisma JSON (named-interface → InputJson). */
function cursorJson(c: RunCursor): Prisma.InputJsonValue {
  return { processed: c.processed };
}

export async function runAgent(adapter: SourceAdapter, opts: RunOptions = {}): Promise<RunReport> {
  const concurrency = opts.concurrency ?? 4;
  const staleAfterMs = opts.staleAfterMs ?? MAX_RUN_MINUTES * 60 * 1000;

  // Source Registry: seed the row, and honour an operator "disabled" flag.
  await ensureRegistrySource(adapter.id);
  if (!(await isSourceEnabled(adapter.id))) {
    return {
      agent: adapter.id,
      status: "SKIPPED",
      runId: "",
      sourceId: null,
      scanned: 0,
      proposed: 0,
      created: 0,
      updated: 0,
      rejected: 0,
      errors: 0,
      skippedLock: false,
    };
  }

  // ------------------------------------------------------------------
  // Lock + resume acquisition.
  // - An actively-locked RUNNING run (fresh lockUntil) → skip (anti-overlap).
  // - Otherwise, if resume is enabled and the latest run for this agent is
  //   RUNNING with an expired/absent lock, continue the SAME run row using
  //   its persisted cursor (only unprocessed documents are worked).
  // ------------------------------------------------------------------
  const latest = await db.agentRun.findFirst({
    where: { agent: adapter.id },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, lockUntil: true, lockToken: true, startedAt: true, metadata: true },
  });

  if (latest && latest.status === "RUNNING" && latest.lockUntil && latest.lockUntil.getTime() > Date.now()) {
    return {
      agent: adapter.id,
      status: "SKIPPED",
      runId: latest.id,
      sourceId: null,
      scanned: 0,
      proposed: 0,
      created: 0,
      updated: 0,
      rejected: 0,
      errors: 0,
      skippedLock: true,
    };
  }

  const lockToken = randomUUID();
  const cursor: RunCursor = { processed: [] };
  const resumeTarget =
    opts.resume &&
    latest &&
    latest.status === "RUNNING" &&
    (latest.lockUntil === null || (latest.lockUntil && latest.lockUntil.getTime() <= Date.now()))
      ? latest
      : null;

  const run = resumeTarget
    ? await db.agentRun.update({
        where: { id: resumeTarget.id },
        data: { lockToken, lockUntil: new Date(Date.now() + staleAfterMs), status: "RUNNING" },
      })
    : await db.agentRun.create({
        data: {
          agent: adapter.id,
          status: "RUNNING",
          details: adapter.name,
          lockToken,
          lockUntil: new Date(Date.now() + staleAfterMs),
          metadata: cursorJson(cursor),
        },
      });

  if (resumeTarget) {
    const prev = (resumeTarget.metadata as RunCursor | null) ?? { processed: [] };
    cursor.processed = Array.isArray(prev.processed) ? prev.processed : [];
  }

  const resumedCount = cursor.processed.length;

  const source = await ensureSource(db, {
    url: adapter.baseUrl,
    name: adapter.name,
    publisher: adapter.publisher,
    sourceType: adapter.sourceType,
  });

  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  const docStats = { checked: 0, new: 0, changed: 0, unchanged: 0 };
  const ctx: RunContext = {
    runId: run.id,
    agentId: adapter.id,
    sourceId: source.id,
    db,
    stats,
    log: (m) => console.log(`[${adapter.id}] ${m}`),
  };
  const runStartedAt = Date.now();

  try {
    // Keep the lock fresh during an active tick.
    const keepalive = setInterval(() => {
      db.agentRun.update({ where: { id: run.id }, data: { lockUntil: new Date(Date.now() + staleAfterMs) } }).catch(() => {});
    }, Math.floor(staleAfterMs / 2));

    const docs = await adapter.discover(ctx);
    const pending = docs.filter((d) => !cursor.processed.includes(d.id));
    stats.scanned = docs.length;
    ctx.log(`discovered ${docs.length} documents (${pending.length} pending, ${cursor.processed.length} done)`);

    const budget = opts.maxDocsPerTick ? Math.min(pending.length, Math.max(opts.maxDocsPerTick, 1)) : pending.length;
    const tick = pending.slice(0, budget);
    const budgetHit = pending.length > tick.length;

    // --- Collector framework: fetch → snapshot → change-detect (Phase 1-3). ---
    const byExternalId = new Map(tick.map((d) => [d.id, d]));
    const descriptors: DocumentDescriptor[] = tick.map((doc) => ({
      externalId: doc.id,
      url: doc.url,
      title: doc.title ?? null,
      publishedAt: doc.publishedAt ?? null,
      metadata: doc.meta ? { meta: doc.meta } : undefined,
      // The adapter still owns its own fetch/decode; the framework hashes the
      // parsed payload for change detection and stores the snapshot.
      fetch: async () => ({ json: await withRetries(() => adapter.fetch(ctx, doc)) }),
    }));

    const collected = await collect(adapter.id, descriptors, { concurrency });
    docStats.checked += collected.checked;
    docStats.new += collected.new;
    docStats.changed += collected.changed;
    docStats.unchanged += collected.unchanged;
    ctx.log(
      `collected ${collected.checked} (${collected.new} new, ${collected.changed} changed, ` +
        `${collected.unchanged} unchanged, ${collected.errors} errors) in ${collected.durationMs}ms`,
    );

    for (const cd of collected.documents) {
      const doc = byExternalId.get(cd.descriptor.externalId)!;
      // Every checked descriptor advances the resume cursor (errors retry on the
      // next full run, not within this tick — avoids an infinite stuck tick).
      cursor.processed.push(doc.id);

      if (cd.change === "error") {
        stats.errors++;
        ctx.log(`collector error on ${doc.id}: ${cd.error}`);
        continue;
      }
      if (cd.change === "unchanged") continue; // Phase 3: skip the expensive chain.

      try {
        const facts = await adapter.parse(ctx, doc, cd.payload!.json);
        stats.proposed += facts.length;
        for (const fact of facts) {
          const proposed = {
            kind: fact.kind,
            source: fact.source,
            target: fact.target,
            relationshipType: fact.relationshipType,
            flowType: fact.flowType,
            role: fact.role,
            amount: fact.amount,
            currency: fact.currency,
            startDate: fact.startDate,
            endDate: fact.endDate,
            periodStart: fact.periodStart,
            periodEnd: fact.periodEnd,
            periodYear: fact.periodYear,
            purpose: fact.purpose,
            confidence: fact.confidence,
            evidenceUrl: fact.evidenceUrl,
            evidenceTitle: doc.title ?? null,
            sourceType: adapter.sourceType,
            sourceName: adapter.name,
            publisher: adapter.publisher,
          };
          const result = await publishVerifiedFact(ctx, proposed);
          if (result.action === "rejected") {
            ctx.log(`rejected: ${result.reason}`);
          } else if (result.action === "candidate") {
            stats.candidates++;
            ctx.log(`candidate: ${result.candidateId}`);
          } else if (adapter.onFactPublished) {
            await adapter.onFactPublished(ctx, fact, result.entityIds);
          }
        }
        await markDocumentProcessed(cd.documentId, { ok: true, parserVersion: adapter.id });
      } catch (e) {
        stats.errors++;
        ctx.log(`error on ${doc.id}: ${(e as Error).message}`);
        await markDocumentProcessed(cd.documentId, { ok: false, error: (e as Error).message });
      }
    }

    clearInterval(keepalive);

    if (budgetHit) {
      // Tick budget exhausted — pause resumably: release the lock, persist the
      // cursor, keep the run open so the next invocation can continue it.
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          lockUntil: null,
          metadata: cursorJson(cursor),
          sourceId: source.id,
          recordsScanned: stats.scanned,
          documentsChecked: docStats.checked,
          documentsNew: docStats.new,
          documentsChanged: docStats.changed,
          documentsUnchanged: docStats.unchanged,
        },
      });
      // Progress was made this tick — the source is healthy.
      await recordRegistryCheck(adapter.id, {
        ok: true,
        docsChecked: docStats.checked,
        docsChanged: docStats.new + docStats.changed,
        durationMs: Date.now() - runStartedAt,
      });
      return {
        agent: adapter.id,
        status: "PARTIAL",
        runId: run.id,
        sourceId: source.id,
        ...stats,
        skippedLock: false,
        continuing: true,
      };
    }

    await markSourceSuccess(db, source.id);
    await recordRegistryCheck(adapter.id, {
      ok: true,
      docsChecked: docStats.checked,
      docsChanged: docStats.new + docStats.changed,
        durationMs: Date.now() - runStartedAt,
    });

    const status: "SUCCESS" | "PARTIAL" = stats.errors > 0 ? "PARTIAL" : "SUCCESS";
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        sourceId: source.id,
        recordsScanned: stats.scanned,
        factsProposed: stats.proposed,
        factsAccepted: stats.proposed - stats.rejected,
        factsRejected: stats.rejected,
        recordsCreated: stats.created,
        recordsUpdated: stats.updated,
        documentsChecked: docStats.checked,
        documentsNew: docStats.new,
        documentsChanged: docStats.changed,
        documentsUnchanged: docStats.unchanged,
        errors: stats.errors,
        lockUntil: null,
        metadata: cursorJson(cursor),
      },
    });
    return {
      agent: adapter.id,
      status,
      runId: run.id,
      sourceId: source.id,
      scanned: stats.scanned,
      proposed: stats.proposed,
      created: stats.created,
      updated: stats.updated,
      rejected: stats.rejected,
      errors: stats.errors,
      skippedLock: false,
      ...(resumedCount > 0 ? { continuing: false } : {}),
    };
  } catch (e) {
    await markSourceFailure(db, source.id, String(e));
    await recordRegistryCheck(adapter.id, { ok: false, error: String(e) });
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "FAILED",
        sourceId: source.id,
        recordsScanned: stats.scanned,
        factsProposed: stats.proposed,
        factsAccepted: stats.proposed - stats.rejected,
        factsRejected: stats.rejected,
        recordsCreated: stats.created,
        recordsUpdated: stats.updated,
        errors: stats.errors + 1,
        details: String(e),
        lockUntil: null,
        metadata: cursorJson(cursor),
      },
    });
    return { agent: adapter.id, status: "FAILED", runId: run.id, sourceId: source.id, ...stats, skippedLock: false };
  }
}

/** Fetch with exponential backoff for transient failures. */
async function withRetries<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const transient = e instanceof TransientError || (e instanceof Error && e.name === "AbortError");
      if (transient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 400);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
}

export type { RunReport };