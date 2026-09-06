// RelationshipCandidate lane (B.5 Phase 3). The published Relationship table is
// never an agent scratchpad: only deterministic official facts publish directly
// (auto-confirm). Everything else — LLM/semantic extraction, secondary or
// ambiguous sources — lands here for a verification decision or human review.

import type { PrismaClient, Prisma, RelationshipType, SourceType } from "@prisma/client";
import type { ProposedFact } from "./types";
import { confidenceToScore } from "@/lib/verification";

export interface CandidateInput {
  fact: ProposedFact;
  resolvedSourceEntityId: string | null;
  resolvedTargetEntityId: string | null;
  agentRunId?: string | null;
}

/** Create (or dedupe) a RelationshipCandidate. Returns its id. */
export async function recordRelationshipCandidate(
  db: PrismaClient,
  input: CandidateInput,
): Promise<{ candidateId: string; deduped: boolean }> {
  const { fact } = input;
  const method = fact.extractionMethod ?? "deterministic-parser";

  // Dedupe: same resolved pair + type + source document still PENDING/NEEDS_REVIEW.
  if (input.resolvedSourceEntityId && input.resolvedTargetEntityId) {
    const existing = await db.relationshipCandidate.findFirst({
      where: {
        resolvedSourceEntityId: input.resolvedSourceEntityId,
        resolvedTargetEntityId: input.resolvedTargetEntityId,
        relationshipType: fact.relationshipType as RelationshipType,
        status: { in: ["PENDING", "NEEDS_REVIEW", "AUTO_ACCEPTABLE"] },
      },
      select: { id: true },
    });
    if (existing) return { candidateId: existing.id, deduped: true };
  }

  const row = await db.relationshipCandidate.create({
    data: {
      sourceEntityRef: fact.source as unknown as Prisma.InputJsonValue,
      targetEntityRef: fact.target as unknown as Prisma.InputJsonValue,
      resolvedSourceEntityId: input.resolvedSourceEntityId,
      resolvedTargetEntityId: input.resolvedTargetEntityId,
      relationshipType: fact.relationshipType as RelationshipType,
      role: fact.role ?? null,
      amount: fact.amount ?? null,
      currency: fact.currency ?? null,
      proposedValidFrom: fact.startDate ?? null,
      proposedValidTo: fact.endDate ?? null,
      confidenceScore: confidenceToScore(fact.confidence),
      extractionMethod: method,
      extractorVersion: fact.extractorVersion ?? null,
      sourceDocumentId: fact.sourceDocumentId ?? null,
      evidenceUrl: fact.evidenceUrl,
      evidenceTitle: fact.evidenceTitle ?? null,
      sourceType: fact.sourceType as SourceType,
      sourceName: fact.sourceName,
      publisher: fact.publisher,
      agentRunId: input.agentRunId ?? null,
      // LLM/manual always needs a human; rules may be auto-acceptable later.
      status: method === "llm" ? "NEEDS_REVIEW" : "PENDING",
    },
    select: { id: true },
  });
  return { candidateId: row.id, deduped: false };
}
