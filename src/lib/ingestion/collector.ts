// Reusable collector: fetch → snapshot → change-detect. One implementation for
// every source. Downstream parse/resolve/extract only runs for new or changed
// documents (Phase 3 invariant).

import type { PrismaClient, Prisma } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";
import { contentHash } from "./hash";
import { guardedFetch } from "./fetch";
import {
  MAX_INLINE_RAW_BYTES,
  type CollectRunSummary,
  type CollectedDocument,
  type CollectedPayload,
  type DocumentDescriptor,
} from "./types";

function rawColumns(payload: CollectedPayload): {
  rawJson?: Prisma.InputJsonValue;
  rawText?: string | null;
  storageRef?: string | null;
} {
  if (payload.json !== undefined) {
    const size = Buffer.byteLength(JSON.stringify(payload.json));
    if (size > MAX_INLINE_RAW_BYTES) return { rawJson: undefined, rawText: null, storageRef: `oversize:${size}` };
    return { rawJson: payload.json as Prisma.InputJsonValue, rawText: null, storageRef: null };
  }
  const text = payload.text ?? "";
  if (Buffer.byteLength(text) > MAX_INLINE_RAW_BYTES) {
    return { rawJson: undefined, rawText: null, storageRef: `oversize:${Buffer.byteLength(text)}` };
  }
  return { rawJson: undefined, rawText: text, storageRef: null };
}

async function collectOne(
  db: PrismaClient,
  ingestionSourceId: string,
  d: DocumentDescriptor,
): Promise<CollectedDocument> {
  const existing = await db.sourceDocument.findUnique({
    where: { ingestionSourceId_externalId: { ingestionSourceId, externalId: d.externalId } },
  });

  let payload: CollectedPayload;
  try {
    payload = d.fetch ? await d.fetch() : await guardedFetch(d.url);
  } catch (e) {
    return {
      descriptor: d,
      documentId: existing?.id ?? "",
      change: "error",
      contentHash: existing?.contentHash ?? "",
      revision: existing?.revision ?? 0,
      error: (e as Error).message,
    };
  }

  const hash = contentHash(payload);
  const now = new Date();
  const cols = rawColumns(payload);

  if (!existing) {
    const created = await db.sourceDocument.create({
      data: {
        ingestionSourceId,
        externalId: d.externalId,
        canonicalUrl: d.url,
        documentType: d.documentType ?? (payload.json !== undefined ? "json" : "text"),
        title: d.title ?? null,
        publishedAt: d.publishedAt ?? null,
        retrievedAt: now,
        contentHash: hash,
        mimeType: payload.mimeType ?? null,
        processingStatus: "PENDING",
        firstSeenAt: now,
        lastSeenAt: now,
        lastChangedAt: now,
        revision: 1,
        metadata: (d.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ...cols,
      },
    });
    return { descriptor: d, documentId: created.id, change: "new", contentHash: hash, revision: 1, payload };
  }

  if (existing.contentHash === hash) {
    await db.sourceDocument.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, retrievedAt: now, mimeType: payload.mimeType ?? existing.mimeType },
    });
    return {
      descriptor: d,
      documentId: existing.id,
      change: "unchanged",
      contentHash: hash,
      revision: existing.revision,
    };
  }

  const updated = await db.sourceDocument.update({
    where: { id: existing.id },
    data: {
      canonicalUrl: d.url,
      contentHash: hash,
      mimeType: payload.mimeType ?? existing.mimeType,
      retrievedAt: now,
      lastSeenAt: now,
      lastChangedAt: now,
      revision: { increment: 1 },
      processingStatus: "PENDING",
      processingError: null,
      title: d.title ?? existing.title,
      publishedAt: d.publishedAt ?? existing.publishedAt,
      metadata: (d.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ...cols,
    },
  });
  return { descriptor: d, documentId: updated.id, change: "changed", contentHash: hash, revision: updated.revision, payload };
}

/**
 * Collect a batch of documents for one source. Returns a summary; only `new`
 * and `changed` entries carry a `payload` for downstream processing.
 */
export async function collect(
  ingestionSourceId: string,
  descriptors: DocumentDescriptor[],
  opts: { db?: PrismaClient; concurrency?: number } = {},
): Promise<CollectRunSummary> {
  const db = opts.db ?? defaultDb;
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const started = Date.now();
  const documents: CollectedDocument[] = new Array(descriptors.length);

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, descriptors.length) }, async () => {
      while (next < descriptors.length) {
        const i = next++;
        documents[i] = await collectOne(db, ingestionSourceId, descriptors[i]);
      }
    }),
  );

  const summary: CollectRunSummary = {
    sourceId: ingestionSourceId,
    checked: documents.length,
    new: documents.filter((d) => d.change === "new").length,
    changed: documents.filter((d) => d.change === "changed").length,
    unchanged: documents.filter((d) => d.change === "unchanged").length,
    errors: documents.filter((d) => d.change === "error").length,
    durationMs: Date.now() - started,
    documents,
  };
  return summary;
}

export async function markDocumentProcessed(
  documentId: string,
  result: { ok: boolean; error?: string | null; parserVersion?: string },
  db: PrismaClient = defaultDb,
): Promise<void> {
  await db.sourceDocument.update({
    where: { id: documentId },
    data: {
      processingStatus: result.ok ? "PROCESSED" : "FAILED",
      processingError: result.ok ? null : (result.error ?? "unknown error").slice(0, 4000),
      parserVersion: result.parserVersion,
    },
  });
}
