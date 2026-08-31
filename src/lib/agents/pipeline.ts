// Ingestion pipeline: discover → fetch → parse → publish (via verified publication service).
// Handles run-locking (no overlapping runs), AgentRun records, source health, retries.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { MAX_RUN_MINUTES, type RunContext, type RunReport, type SourceAdapter } from "./types";
import { mapWithConcurrency, TransientError, sleep } from "./http";
import { ensureSource, markSourceFailure, markSourceSuccess, publishVerifiedFact } from "./publish";

export interface RunOptions {
  concurrency?: number;
  /** Allow taking over a stale RUNNING run. */
  staleAfterMs?: number;
}

export async function runAgent(adapter: SourceAdapter, opts: RunOptions = {}): Promise<RunReport> {
  const concurrency = opts.concurrency ?? 4;
  const staleAfterMs = opts.staleAfterMs ?? MAX_RUN_MINUTES * 60 * 1000;

  // Acquire run lock: no overlapping RUNNING run within the stale window.
  // A run is considered active if it has a fresh lockUntil (keepalive renews it).
  const active = await db.agentRun.findFirst({
    where: {
      agent: adapter.id,
      status: "RUNNING",
      OR: [
        { lockUntil: { gt: new Date() } },
        { lockUntil: null, startedAt: { gt: new Date(Date.now() - staleAfterMs) } },
      ],
    },
    select: { id: true },
  });
  if (active) {
    return {
      agent: adapter.id,
      status: "SKIPPED",
      runId: active.id,
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
  const run = await db.agentRun.create({
    data: {
      agent: adapter.id,
      status: "RUNNING",
      details: adapter.name,
      lockToken,
      lockUntil: new Date(Date.now() + staleAfterMs),
    },
  });

  const source = await ensureSource(db, {
    url: adapter.baseUrl,
    name: adapter.name,
    publisher: adapter.publisher,
    sourceType: adapter.sourceType,
  });

  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0 };
  const ctx: RunContext = {
    runId: run.id,
    agentId: adapter.id,
    sourceId: source.id,
    db,
    stats,
    log: (m) => console.log(`[${adapter.id}] ${m}`),
  };

  try {
    // Keep the lock fresh during a long run.
    const keepalive = setInterval(() => {
      db.agentRun.update({ where: { id: run.id }, data: { lockUntil: new Date(Date.now() + staleAfterMs) } }).catch(() => {});
    }, Math.floor(staleAfterMs / 2));

    const docs = await adapter.discover(ctx);
    stats.scanned = docs.length;
    ctx.log(`discovered ${docs.length} documents`);

    await mapWithConcurrency(docs, concurrency, async (doc) => {
      try {
        const raw = await withRetries(() => adapter.fetch(ctx, doc));
        const facts = await adapter.parse(ctx, doc, raw);
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
          } else if (adapter.onFactPublished) {
            await adapter.onFactPublished(ctx, fact, result.entityIds);
          }
        }
      } catch (e) {
        stats.errors++;
        ctx.log(`error on ${doc.id}: ${(e as Error).message}`);
      }
    });

    clearInterval(keepalive);
    await markSourceSuccess(db, source.id);

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
        errors: stats.errors,
        lockUntil: null,
      },
    });
    return { agent: adapter.id, status, runId: run.id, sourceId: source.id, ...stats, skippedLock: false };
  } catch (e) {
    await markSourceFailure(db, source.id, String(e));
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