import type { PrismaClient, SourceType, RelationshipType, FlowType, EntityType, Confidence } from "@prisma/client";

/** A stable, source-side identified document (one unit of ingestion). */
export interface SourceDocument {
  id: string;
  url: string;
  title: string;
  publishedAt?: Date | null;
  /** Content hash used for change detection. */
  hash: string;
  /** Optional adapter-specific metadata captured during discovery. */
  meta?: unknown;
}

/** A normalized, publishable fact (relationship or financial flow). */
export interface NormalizedFact {
  kind: "relationship" | "flow";
  source: EntityRef;
  target: EntityRef;
  relationshipType?: RelationshipType;
  flowType?: FlowType;
  role?: string | null;
  amount?: number | null;
  currency?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  periodYear?: number | null;
  purpose?: string | null;
  confidence: Confidence;
  /** Evidence URL (must be a real retrievable source). */
  evidenceUrl: string;
  /** Unique natural key used for idempotent upsert. */
  dedupeKey?: string;
  /** Profile metadata for the source entity (used by adapter profile hooks only). */
  sourceProfile?: Record<string, unknown>;
}

/** A fact proposed by an agent, ready for verification + publication. */
export interface ProposedFact {
  kind: "relationship" | "flow";
  source: EntityRef;
  target: EntityRef;
  relationshipType?: RelationshipType;
  flowType?: FlowType;
  role?: string | null;
  amount?: number | null;
  currency?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  periodYear?: number | null;
  purpose?: string | null;
  confidence: Confidence;
  evidenceUrl: string;
  evidenceTitle?: string | null;
  sourceType: SourceType;
  sourceName: string;
  publisher: string;
}

/** Reference to an entity that must be resolved (never merged on name alone). */
export interface EntityRef {
  type: EntityType;
  name: string;
  subtype?: string | null;
  /** Strong external identifier (provider + identifier), preferred for resolution. */
  externalId?: { provider: string; identifier: string } | null;
  businessId?: string | null;
  jurisdiction?: string | null;
  municipality?: string | null;
  description?: string | null;
  alias?: string | null;
}

export interface RunStats {
  scanned: number;
  proposed: number;
  created: number;
  updated: number;
  rejected: number;
  errors: number;
}

export interface RunContext {
  runId: string;
  agentId: string;
  sourceId: string;
  db: PrismaClient;
  stats: RunStats;
  log: (msg: string) => void;
}

export interface AdapterResult {
  scanned: number;
  proposed: number;
  created: number;
  updated: number;
  rejected: number;
  errors: number;
}

export interface SourceAdapter {
  id: string;
  name: string;
  sourceType: SourceType;
  /** "daily" | "weekly" — used by the orchestrator. */
  schedule: "daily" | "weekly";
  /** Base evidence URL of the source. */
  baseUrl: string;
  publisher: string;
  /** Discover the documents to ingest (idempotent list). */
  discover(ctx: RunContext): Promise<SourceDocument[]>;
  /** Fetch raw content for a document. */
  fetch(ctx: RunContext, doc: SourceDocument): Promise<unknown>;
  /** Parse raw content into normalized facts. */
  parse(ctx: RunContext, doc: SourceDocument, raw: unknown): Promise<NormalizedFact[]>;
  /** Optional hook after a fact is successfully published (e.g. profile metadata). */
  onFactPublished?(ctx: RunContext, fact: NormalizedFact, entityIds: { source: string | null; target: string | null }): Promise<void>;
}

export const MAX_RUN_MINUTES = 20;

export interface RunReport {
  agent: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  runId: string;
  sourceId: string | null;
  scanned: number;
  proposed: number;
  created: number;
  updated: number;
  rejected: number;
  errors: number;
  skippedLock: boolean;
}