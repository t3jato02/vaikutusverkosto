// Verified Publication Service.
// THE ONLY path agents may use to create PUBLIC relationships or financial flows.
// Agents call proposeFact(...) → verifyFact(...) → publishVerifiedFact(...).
// Direct prisma.relationship.create / financialFlow.create inside agents is forbidden
// by design; adapters must route writes through this module.

import type { PrismaClient, SourceType, RelationshipType, FlowType, Confidence } from "@prisma/client";
import type { RunContext, ProposedFact } from "./types";
import { resolveEntity } from "./entityResolution";
import { confidenceToScore, deriveAgentStatus } from "@/lib/verification";

export interface PublicationResult {
  action: "created" | "updated" | "unchanged" | "rejected";
  reason?: string;
  entityIds: { source: string | null; target: string | null };
}

const MAX_AMOUNT = 1e14; // sanity bound: 100 trillion €

export async function ensureSource(
  db: PrismaClient,
  opts: { url: string; name: string; publisher: string; sourceType: SourceType; documentTitle?: string | null },
) {
  return db.source.upsert({
    where: { sourceUrl: opts.url },
    update: { lastCheckedAt: new Date(), publisher: opts.publisher },
    create: {
      sourceUrl: opts.url,
      sourceName: opts.name,
      publisher: opts.publisher,
      sourceType: opts.sourceType,
      confidence: "HIGH",
      documentTitle: opts.documentTitle ?? null,
      lastCheckedAt: new Date(),
      status: "ACTIVE",
    },
  });
}

export async function markSourceSuccess(db: PrismaClient, sourceId: string) {
  await db.source.update({
    where: { id: sourceId },
    data: { status: "ACTIVE", consecutiveFailures: 0, lastSuccessAt: new Date(), lastCheckedAt: new Date() },
  });
}

export async function markSourceFailure(db: PrismaClient, sourceId: string, error: string) {
  await db.source.update({
    where: { id: sourceId },
    data: { status: "FAILED", consecutiveFailures: { increment: 1 }, lastCheckedAt: new Date() },
  });
  console.error(`source health: ${sourceId} failed — ${error}`);
}

/** Validate a proposed fact against hard invariants (P8). */
export function verifyFact(fact: ProposedFact): { ok: boolean; reason?: string } {
  if (fact.kind === "flow") {
    if (fact.amount === null || fact.amount === undefined) return { ok: false, reason: "flow without amount" };
    if (!Number.isFinite(fact.amount) || Math.abs(fact.amount) > MAX_AMOUNT)
      return { ok: false, reason: "flow amount out of bounds" };
    if (!fact.currency) return { ok: false, reason: "flow without currency" };
    if (!fact.flowType) return { ok: false, reason: "flow without flowType" };
  }
  if (fact.kind === "relationship" && !fact.relationshipType)
    return { ok: false, reason: "relationship without relationshipType" };
  if (!fact.evidenceUrl) return { ok: false, reason: "fact without evidence URL" };
  if (fact.confidence === "LOW") return { ok: false, reason: "LOW confidence not published by default" };
  if (!fact.source.name || !fact.target.name) return { ok: false, reason: "fact without both entities" };
  return { ok: true };
}

export async function publishVerifiedFact(
  ctx: RunContext,
  fact: ProposedFact,
): Promise<PublicationResult> {
  const v = verifyFact(fact);
  if (!v.ok) {
    ctx.stats.rejected++;
    return { action: "rejected", reason: v.reason, entityIds: { source: null, target: null } };
  }

  const db = ctx.db;

  // Resolve entities (never merge on name alone).
  const src = await resolveEntity(db, fact.source);
  if (src.status === "unresolved") {
    ctx.stats.rejected++;
    return { action: "rejected", reason: `unresolved source entity (candidate ${src.candidateId})`, entityIds: { source: null, target: null } };
  }
  if (src.status === "rejected") {
    ctx.stats.rejected++;
    return { action: "rejected", reason: src.reason, entityIds: { source: null, target: null } };
  }
  const tgt = await resolveEntity(db, fact.target);
  if (tgt.status === "unresolved") {
    ctx.stats.rejected++;
    return { action: "rejected", reason: `unresolved target entity (candidate ${tgt.candidateId})`, entityIds: { source: src.entityId, target: null } };
  }
  if (tgt.status === "rejected") {
    ctx.stats.rejected++;
    return { action: "rejected", reason: tgt.reason, entityIds: { source: src.entityId, target: null } };
  }

  // Guard: a relationship/flow must connect two distinct entities unless the
  // type explicitly permits self-reference (none do today).
  if (src.entityId === tgt.entityId) {
    ctx.stats.rejected++;
    return { action: "rejected", reason: "self-relationship not allowed", entityIds: { source: src.entityId, target: src.entityId } };
  }

  const evidenceSource = await ensureSource(db, {
    url: fact.evidenceUrl,
    name: fact.sourceName,
    publisher: fact.publisher,
    sourceType: fact.sourceType,
    documentTitle: fact.evidenceTitle ?? null,
  });

  if (fact.kind === "relationship") {
    const result = await upsertRelationship(ctx, {
      sourceEntityId: src.entityId,
      targetEntityId: tgt.entityId,
      relationshipType: fact.relationshipType!,
      role: fact.role ?? null,
      startDate: fact.startDate ?? null,
      endDate: fact.endDate ?? null,
      confidence: fact.confidence,
      sourceType: fact.sourceType,
      sourceId: evidenceSource.id,
      createdBy: ctx.agentId,
    });
    return { action: result, entityIds: { source: src.entityId, target: tgt.entityId } };
  }

  // flow
  const flow = await upsertFlow(ctx, {
    payerEntityId: src.entityId,
    recipientEntityId: tgt.entityId,
    amount: fact.amount!,
    currency: fact.currency!,
    flowType: fact.flowType!,
    flowDate: fact.startDate ?? null,
    periodStart: fact.periodStart ?? fact.startDate ?? null,
    periodEnd: fact.periodEnd ?? fact.endDate ?? null,
    periodYear: fact.periodYear ?? null,
    purpose: fact.purpose ?? null,
    confidence: fact.confidence,
    sourceType: fact.sourceType,
    sourceId: evidenceSource.id,
  });
  return { action: flow, entityIds: { source: src.entityId, target: tgt.entityId } };
}

// ---------------------------------------------------------------------------
// Internal upserts (idempotent + change detection)
// ---------------------------------------------------------------------------

async function upsertRelationship(
  ctx: RunContext,
  o: {
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: RelationshipType;
    role: string | null;
    startDate: Date | null;
    endDate: Date | null;
    confidence: Confidence;
    sourceType: SourceType;
    sourceId: string;
    createdBy: string;
  },
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await ctx.db.relationship.findFirst({
    where: {
      sourceEntityId: o.sourceEntityId,
      targetEntityId: o.targetEntityId,
      relationshipType: o.relationshipType,
      role: o.role,
      startDate: o.startDate ?? null,
    },
  });
  if (existing) {
    const endChanged = (existing.endDate?.getTime() ?? null) !== (o.endDate?.getTime() ?? null);
    const confChanged = existing.confidence !== o.confidence;
    if (endChanged || confChanged) {
      await ctx.db.relationship.update({
        where: { id: existing.id },
        data: { endDate: o.endDate, confidence: o.confidence, lastVerifiedAt: new Date() },
      });
      await ctx.db.changeLog.create({
        data: {
          eventType: endChanged ? "RELATIONSHIP_ENDED" : "RELATIONSHIP_ADDED",
          entityId: o.sourceEntityId,
          relationshipId: existing.id,
          sourceId: o.sourceId,
          description: `Yhteyden päättymispäivä päivitetty: ${o.relationshipType}`,
          occurredAt: new Date(),
        },
      });
      ctx.stats.updated++;
      return "updated";
    }
    ctx.stats.updated++;
    return "unchanged";
  }
  // A7: an agent may only ever produce AUTO_DETECTED or SOURCE_CONFIRMED.
  const verificationStatus = deriveAgentStatus({ sourceType: o.sourceType, confidence: o.confidence });
  const rel = await ctx.db.relationship.create({
    data: {
      sourceEntityId: o.sourceEntityId,
      targetEntityId: o.targetEntityId,
      relationshipType: o.relationshipType,
      role: o.role,
      startDate: o.startDate,
      endDate: o.endDate,
      confidence: o.confidence,
      confidenceScore: confidenceToScore(o.confidence),
      verificationState: "PUBLISHED",
      verificationStatus,
      createdBy: o.createdBy,
      lastVerifiedAt: new Date(),
      evidence: { create: [{ sourceId: o.sourceId, confidence: o.confidence }] },
    },
  });
  await ctx.db.changeLog.create({
    data: {
      eventType: "RELATIONSHIP_ADDED",
      entityId: o.sourceEntityId,
      relationshipId: rel.id,
      sourceId: o.sourceId,
      description: `Uusi yhteys: ${o.relationshipType}`,
      occurredAt: new Date(),
    },
  });
  ctx.stats.created++;
  return "created";
}

async function upsertFlow(
  ctx: RunContext,
  o: {
    payerEntityId: string;
    recipientEntityId: string;
    amount: number;
    currency: string;
    flowType: FlowType;
    flowDate: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    periodYear: number | null;
    purpose: string | null;
    confidence: Confidence;
    sourceType: SourceType;
    sourceId: string;
  },
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await ctx.db.financialFlow.findFirst({
    where: {
      payerEntityId: o.payerEntityId,
      recipientEntityId: o.recipientEntityId,
      flowType: o.flowType,
      periodYear: o.periodYear ?? null,
    },
  });
  if (existing) {
    const changed = Number(existing.amount) !== o.amount;
    if (changed) {
      await ctx.db.financialFlow.update({
        where: { id: existing.id },
        data: { amount: o.amount, purpose: o.purpose ?? existing.purpose, updatedAt: new Date() },
      });
      await ctx.db.changeLog.create({
        data: {
          eventType: "AMOUNT_CHANGED",
          flowId: existing.id,
          sourceId: o.sourceId,
          description: `Rahavirran summa päivittyi (${o.flowType})`,
          occurredAt: new Date(),
        },
      });
      ctx.stats.updated++;
      return "updated";
    }
    ctx.stats.updated++;
    return "unchanged";
  }
  const verificationStatus = deriveAgentStatus({ sourceType: o.sourceType, confidence: o.confidence });
  const flow = await ctx.db.financialFlow.create({
    data: {
      payerEntityId: o.payerEntityId,
      recipientEntityId: o.recipientEntityId,
      amount: o.amount,
      currency: o.currency,
      flowType: o.flowType,
      flowDate: o.flowDate,
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      periodYear: o.periodYear,
      purpose: o.purpose,
      confidence: o.confidence,
      confidenceScore: confidenceToScore(o.confidence),
      verificationState: "PUBLISHED",
      verificationStatus,
      sourceCount: 1,
      evidence: { create: [{ sourceId: o.sourceId, confidence: o.confidence }] },
    },
  });
  await ctx.db.changeLog.create({
    data: {
      eventType: "NEW_GRANT",
      flowId: flow.id,
      sourceId: o.sourceId,
      description: `Uusi rahavirta: ${o.flowType} ${o.amount} ${o.currency}`,
      occurredAt: new Date(),
    },
  });
  ctx.stats.created++;
  return "created";
}