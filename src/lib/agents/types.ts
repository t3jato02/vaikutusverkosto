import type { PrismaClient, SourceType, RelationshipType, FlowType, FundingType, EntityType, Confidence, BenefitEventType, ValuePrecision } from "@prisma/client";

/** Optional project a financial flow funds (Sprint C2). */
export interface ProjectRef {
  sourceIdentifier?: string | null;
  name: string;
  programme?: string | null;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  locationCountry?: string | null;
  municipality?: string | null;
}

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
  /** Per-fact source strength override (the adapter has one global sourceType;
   *  a manifest may mix official and secondary evidence for individual facts). */
  sourceTypeOverride?: SourceType;
  /** Extraction provenance. "rule"/"llm"/"manual" route to the candidate lane. */
  extractionMethod?: "deterministic-parser" | "rule" | "llm" | "manual";
  extractorVersion?: string;
  /** Source explicitly asserts a present-day active role. */
  assertedCurrent?: boolean;
  // Sprint C2 — foreign funding / project.
  externalRecordId?: string;
  rawFundingType?: string | null;
  fundingType?: FundingType;
  funderCountryCode?: string | null;
  recipientCountryCode?: string | null;
  projectRef?: ProjectRef;
  /** Ownership / shareholding percentage (0-100), for OWNS-family relationships. */
  ownershipPercent?: number;
}

// ---------------------------------------------------------------- benefit events & financial statements
//
// Public media finance (sections 3 & 6): benefit/gift/award/hospitality events
// and year-by-year financial-statement line items are first-class facts that
// the ingestion pipeline can propose alongside relationships and flows.

/** A proposed, source-backed benefit event (gift / award / honour / portrait / ...). */
export interface BenefitEventFact {
  kind: "benefit";
  eventType: BenefitEventType;
  title: string;
  description?: string | null;
  /** Giver / awarding organisation (optional — a documented event may not name one). */
  giver?: EntityRef | null;
  /** Recipient (optional — a portrait may only name subject + artist). */
  recipient?: EntityRef | null;
  payer?: EntityRef | null;
  beneficiary?: EntityRef | null;
  /** Portrait / commissioned work: subject and artist (section 8). */
  subject?: EntityRef | null;
  artist?: EntityRef | null;
  eventDate?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  monetaryValue?: number | null;
  currency?: string;
  valueType: ValuePrecision;
  publicFundsUsed?: boolean | null;
  country?: string | null;
  /** "winner" | "selection" | "jury" | other documented role (section 9). */
  selectionRole?: string | null;
  confidence: Confidence;
  /** Evidence URL (must be a real retrievable source). */
  evidenceUrl: string;
  evidenceTitle?: string | null;
  sourceType: SourceType;
  sourceName: string;
  publisher: string;
  /** "deterministic-parser" / official sources may auto-publish; otherwise review. */
  extractionMethod?: "deterministic-parser" | "rule" | "llm" | "manual";
  extractorVersion?: string;
  sourceDocumentId?: string | null;
  /** Unique natural key used for idempotent upsert. */
  dedupeKey: string;
  /** Evidence-grade of the underlying source (A–E, default C). */
  evidenceGrade?: "A" | "B" | "C" | "D" | "E";
}

/** A year-by-year financial-statement line item of an organisation (section 3). */
export interface StatementItemFact {
  kind: "statement";
  entity: EntityRef;
  fiscalYear: number;
  statementKind: "INCOME" | "EXPENDITURE";
  category: string; // stable machine key, e.g. "YLE_APPROPRIATION"
  categoryLabel: string; // human label from the source document
  amount: number;
  currency: string;
  valueType: ValuePrecision;
  /** Grand-total row — never summed together with its child categories (section 43). */
  isTotal?: boolean;
  note?: string | null;
  /** The official document this line comes from. */
  reportUrl: string;
  evidenceTitle?: string | null;
  sourceType: SourceType;
  sourceName: string;
  publisher: string;
  sourceDocumentId?: string | null;
  /** Unique natural key used for idempotent upsert. */
  dedupeKey: string;
}

/** Every fact kind an adapter may propose. */
export type AgentFact = NormalizedFact | BenefitEventFact | StatementItemFact;

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
  /** How the fact was extracted. "llm" and non-official sources route to the
   *  RelationshipCandidate lane instead of publishing directly. */
  extractionMethod?: "deterministic-parser" | "rule" | "llm" | "manual";
  extractorVersion?: string;
  sourceDocumentId?: string | null;
  /** Source explicitly asserts a present-day active role. */
  assertedCurrent?: boolean;
  // Sprint C2 — foreign funding / project.
  externalRecordId?: string;
  rawFundingType?: string | null;
  fundingType?: FundingType;
  funderCountryCode?: string | null;
  recipientCountryCode?: string | null;
  projectRef?: ProjectRef;
  /** Ownership / shareholding percentage (0-100), for OWNS-family relationships. */
  ownershipPercent?: number;
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
  /** ISO-3166 alpha-2, set on entity creation (Sprint C). */
  countryCode?: string | null;
  /** Institutional classification, set on creation when known (Sprint C). */
  entityCategory?:
    | "GOVERNMENT" | "GOVERNMENT_AGENCY" | "STATE_OWNED_COMPANY" | "COMPANY"
    | "FOUNDATION" | "NGO" | "RELIGIOUS_ORGANIZATION" | "THINK_TANK" | "UNIVERSITY"
    | "INTERNATIONAL_ORGANIZATION" | "POLITICAL_PARTY" | "MEDIA_ORGANIZATION" | "OTHER";
}

export interface RunStats {
  scanned: number;
  proposed: number;
  created: number;
  updated: number;
  rejected: number;
  errors: number;
  candidates: number;
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

export type ReliabilityTierName =
  | "OFFICIAL_PRIMARY"
  | "OFFICIAL_REGISTER"
  | "PUBLIC_DISCLOSURE"
  | "ANNUAL_REPORT"
  | "REPUTABLE_MEDIA"
  | "OTHER";

export interface SourceAdapter {
  id: string;
  name: string;
  sourceType: SourceType;
  /** "daily" | "weekly" — used by the orchestrator. */
  schedule: "daily" | "weekly";
  /** Base evidence URL of the source. */
  baseUrl: string;
  publisher: string;
  // ---- Source Registry metadata (Sprint B). Optional; sensible defaults. ----
  /** Intrinsic provenance strength. Defaults to OFFICIAL_PRIMARY. */
  reliabilityTier?: ReliabilityTierName;
  /** Access shape. Defaults to "API". */
  format?: "API" | "HTML" | "PDF" | "RSS";
  /** Ingestion cadence; defaults to `schedule`. */
  updateCadence?: "daily" | "weekly" | "monthly";
  /** URL of the source's terms of use / licence, if any. */
  termsUrl?: string;
  /** Free-text operator notes (licence, quirks, restrictions). */
  notes?: string;
  /** Discover the documents to ingest (idempotent list). */
  discover(ctx: RunContext): Promise<SourceDocument[]>;
  /** Fetch raw content for a document. */
  fetch(ctx: RunContext, doc: SourceDocument): Promise<unknown>;
  /** Parse raw content into normalized facts. */
  parse(ctx: RunContext, doc: SourceDocument, raw: unknown): Promise<AgentFact[]>;
  /** Optional hook after a fact is successfully published (e.g. profile metadata). */
  onFactPublished?(ctx: RunContext, fact: AgentFact, entityIds: { source: string | null; target: string | null }): Promise<void>;
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
  candidates?: number;
  skippedLock: boolean;
  /** True when a budget-tick ended before the full batch was processed (resumable). */
  continuing?: boolean;
}