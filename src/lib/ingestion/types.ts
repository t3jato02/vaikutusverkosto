// Reusable ingestion framework — types shared by every source adapter.
// The framework is deliberately NOT tied to any one adapter.

export type DocumentType = "json" | "html" | "pdf" | "text";

/** A document the collector should fetch and track for a given source. */
export interface DocumentDescriptor {
  /** Stable id for this document within its source (used for dedup + revisions). */
  externalId: string;
  /** Canonical retrievable URL. */
  url: string;
  documentType?: DocumentType;
  title?: string | null;
  publishedAt?: Date | null;
  /** Adapter-specific metadata to persist alongside the document. */
  metadata?: Record<string, unknown>;
  /**
   * Optional custom fetcher (e.g. a POST with a body). Defaults to a plain GET
   * through the framework's guarded fetch. Must return the payload to hash.
   */
  fetch?: () => Promise<CollectedPayload>;
}

export interface CollectedPayload {
  json?: unknown;
  text?: string;
  mimeType?: string | null;
  /** HTTP status / transport metadata for observability. */
  http?: { status: number; url: string; ms: number };
}

export type DocumentChange = "new" | "changed" | "unchanged" | "error";

export interface CollectedDocument {
  descriptor: DocumentDescriptor;
  /** DB row id of the SourceDocument. */
  documentId: string;
  change: DocumentChange;
  contentHash: string;
  revision: number;
  payload?: CollectedPayload;
  error?: string;
}

export interface CollectRunSummary {
  sourceId: string;
  checked: number;
  new: number;
  changed: number;
  unchanged: number;
  errors: number;
  durationMs: number;
  documents: CollectedDocument[];
}

/** Max raw payload persisted to a Postgres column; larger goes to storageRef. */
export const MAX_INLINE_RAW_BYTES = 3 * 1024 * 1024;
