// Content-analysis result types (sections 4, 13).
//
// These results are DATA-ANALYSIS (the app computed them from public
// publication metadata), never a statement about a person's political view.
// Every result ships with the corpus size, period, method and a robustness
// confidence so the reader can judge the distribution themselves.

import type { AnalysisKind, JournalisticGenre, MentionRole } from "@prisma/client";

export const CONTENT_ANALYSIS_ALGORITHM = "journalist_content_v1";

export interface EntityRef {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
}

export interface DistributionBucket {
  key: string;
  name: string;
  count: number;
}

export interface PartyCoverageBucket extends DistributionBucket {
  shareOfPoliticsPct: number;
  framing: FramingEstimate | null;
}

export interface PersonCoverageBucket extends DistributionBucket {
  type: string;
  isPolitician: boolean;
  articleCount: number;
}

export interface FramingEstimate {
  positive: number;
  neutral: number;
  critical: number;
  total: number;
  method: "lexicon_v1";
  /** 0..1 — how confident we are in this single estimate (usually low). */
  confidence: number;
  limitation: string;
}

export interface CoverageResult {
  algorithmVersion: string;
  period: { start: string | null; end: string | null };
  /** Distinct public articles in the corpus. */
  corpusSize: number;
  /** Articles classified as about politics (mention ≥1 party or politician). */
  politicsArticleCount: number;
  headlineCount: number;
  publishers: DistributionBucket[];
  genres: DistributionBucket[];
  topics: DistributionBucket[];
  countries: DistributionBucket[];
  sourceRoles: DistributionBucket[];
  parties: PartyCoverageBucket[];
  politicians: PersonCoverageBucket[];
  quotedExperts: PersonCoverageBucket[];
  framing: FramingEstimate | null;
  robustness: number; // 0..1 coverage robustness; not a truth score
  limitations: string[];
}

export interface AnalysisQuery {
  scopeEntityId?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  /** If false the framing (lexicon sentiment) estimate is skipped. */
  includeFraming?: boolean;
}

export interface ComparisonCell {
  query: { scopeEntityId: string; periodStart: string | null; periodEnd: string | null };
  corpusSize: number;
  politicsArticleCount: number;
  genres: DistributionBucket[];
  parties: PartyCoverageBucket[];
  politicians: PersonCoverageBucket[];
  topics: DistributionBucket[];
}

export type ResultByKind = Partial<Record<AnalysisKind, CoverageResult>>;

export interface ScopeHashInput {
  scope: string;
  entityId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  kind: AnalysisKind;
  algorithmVersion: string;
}

// Genre buckets are stored as string keys; UI maps them via genreLabel().
export const GENRE_KEYS: JournalisticGenre[] = [
  "NEWS",
  "ANALYSIS",
  "COMMENT",
  "COLUMN",
  "OPINION",
  "INVESTIGATIVE",
  "INTERVIEW",
  "OTHER",
];

export const MENTION_ROLE_KEYS: MentionRole[] = [
  "SUBJECT",
  "SOURCE",
  "QUOTED_EXPERT",
  "ORGANIZATION",
  "COUNTRY",
  "TOPIC",
];