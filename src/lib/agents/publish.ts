// Verified Publication Service.
// THE ONLY path agents may use to create PUBLIC relationships or financial flows.
// Agents call proposeFact(...) → verifyFact(...) → publishVerifiedFact(...).
// Direct prisma.relationship.create / financialFlow.create inside agents is forbidden
// by design; adapters must route writes through this module.

import type { PrismaClient, SourceType, RelationshipType, FlowType, FundingType, Confidence, EntityStatus } from "@prisma/client";
import type { RunContext, ProposedFact, BenefitEventFact, StatementItemFact, EntityRef } from "./types";
import { resolveEntity } from "./entityResolution";
import { confidenceToScore, deriveAgentStatus } from "@/lib/verification";
import { deriveTemporalState } from "@/lib/temporal";
import { recordRelationshipCandidate } from "./candidates";

export interface PublicationResult {
  action: "created" | "updated" | "unchanged" | "rejected" | "candidate";
  reason?: string;
  candidateId?: string;
  entityIds: { source: string | null; target: string | null };
}

const MAX_AMOUNT = 1e14; // sanity bound: 100 trillion €

const FUNDING_TYPE_BY_FLOW: Partial<Record<FlowType, FundingType>> = {
  POLITICAL_DONATION: "DONATION",
  CAMPAIGN_FUNDING: "DONATION",
  PUBLIC_GRANT: "GRANT",
  GOVERNMENT_SUBSIDY: "GRANT",
  MUNICIPAL_GRANT: "GRANT",
  EU_FUNDING: "GRANT",
  RESEARCH_FUNDING: "GRANT",
  FOUNDATION_GRANT: "GRANT",
  ASSOCIATION_FUNDING: "GRANT",
  PUBLIC_PROJECT_FUNDING: "GRANT",
  PROCUREMENT: "PROCUREMENT",
  CONTENT_PROCUREMENT: "PROCUREMENT",
  CONSULTING_PAYMENT: "PROCUREMENT",
  INVESTMENT: "INVESTMENT",
  OWNERSHIP: "INVESTMENT",
  SPONSORSHIP: "SPONSORSHIP",
  RIGHTS_PAYMENT: "OTHER",
};
function mapFundingType(t: FlowType): FundingType {
  return FUNDING_TYPE_BY_FLOW[t] ?? "OTHER";
}

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
    // Candidate lane: only deterministic official facts publish directly.
    // LLM/semantic extraction and non-official sources are parked.
    const method = fact.extractionMethod ?? "deterministic-parser";
    const wouldConfirm = deriveAgentStatus({ sourceType: fact.sourceType, confidence: fact.confidence }) === "SOURCE_CONFIRMED";
    // Only a deterministic parse of a structured official field auto-publishes.
    // Any interpretation of free text (rule/llm) or a weaker source → review.
    if (method !== "deterministic-parser" || !wouldConfirm) {
      const { candidateId } = await recordRelationshipCandidate(db, {
        fact,
        resolvedSourceEntityId: src.entityId,
        resolvedTargetEntityId: tgt.entityId,
        agentRunId: ctx.runId,
      });
      return { action: "candidate", candidateId, entityIds: { source: src.entityId, target: tgt.entityId } };
    }

    const result = await upsertRelationship(ctx, {
      sourceEntityId: src.entityId,
      targetEntityId: tgt.entityId,
      relationshipType: fact.relationshipType!,
      role: fact.role ?? null,
      startDate: fact.startDate ?? null,
      endDate: fact.endDate ?? null,
      assertedCurrent: fact.assertedCurrent,
      ownershipPercent: fact.ownershipPercent ?? null,
      confidence: fact.confidence,
      sourceType: fact.sourceType,
      sourceId: evidenceSource.id,
      createdBy: ctx.agentId,
    });
    return { action: result, entityIds: { source: src.entityId, target: tgt.entityId } };
  }

  // flow
  // Optional project link (Sprint C2) — deduped by source project identifier.
  let projectId: string | null = null;
  if (fact.projectRef?.name) {
    const pr = fact.projectRef;
    if (pr.sourceIdentifier) {
      const p = await db.project.upsert({
        where: { sourceIdentifier: pr.sourceIdentifier },
        update: {
          name: pr.name,
          programme: pr.programme ?? undefined,
          description: pr.description ?? undefined,
          startDate: pr.startDate ?? undefined,
          endDate: pr.endDate ?? undefined,
          locationCountry: pr.locationCountry ?? undefined,
          municipality: pr.municipality ?? undefined,
          funderEntityId: src.entityId,
        },
        create: {
          sourceIdentifier: pr.sourceIdentifier,
          name: pr.name,
          programme: pr.programme ?? null,
          description: pr.description ?? null,
          startDate: pr.startDate ?? null,
          endDate: pr.endDate ?? null,
          locationCountry: pr.locationCountry ?? null,
          municipality: pr.municipality ?? null,
          locationPrecision: pr.municipality ? "MUNICIPALITY" : pr.locationCountry ? "COUNTRY" : "COUNTRY",
          funderEntityId: src.entityId,
        },
        select: { id: true },
      });
      projectId = p.id;
    }
  }
  const flow = await upsertFlow(ctx, {
    payerEntityId: src.entityId,
    recipientEntityId: tgt.entityId,
    amount: fact.amount!,
    currency: fact.currency!,
    flowType: fact.flowType!,
    fundingTypeOverride: fact.fundingType ?? null,
    rawFundingType: fact.rawFundingType ?? null,
    externalRecordId: fact.externalRecordId ?? null,
    funderCountryCodeOverride: fact.funderCountryCode ?? null,
    recipientCountryCodeOverride: fact.recipientCountryCode ?? null,
    projectId,
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
    assertedCurrent?: boolean;
    ownershipPercent?: number | null;
    confidence: Confidence;
    sourceType: SourceType;
    sourceId: string;
    createdBy: string;
  },
): Promise<"created" | "updated" | "unchanged"> {
  const temporalOf = (status: EntityStatus) =>
    deriveTemporalState({ validFrom: o.startDate, validTo: o.endDate, status, assertedCurrent: o.assertedCurrent });
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
    // Phase 7 — cross-source corroboration: attach this source's evidence to the
    // SAME canonical edge (never a second graph edge). Count distinct sources.
    const already = await ctx.db.evidence.findFirst({
      where: { relationshipId: existing.id, sourceId: o.sourceId },
      select: { id: true },
    });
    if (!already) {
      await ctx.db.evidence.create({
        data: { relationshipId: existing.id, sourceId: o.sourceId, confidence: o.confidence },
      });
      const distinct = await ctx.db.evidence.findMany({
        where: { relationshipId: existing.id },
        select: { sourceId: true },
        distinct: ["sourceId"],
      });
      await ctx.db.relationship.update({
        where: { id: existing.id },
        data: { supportingSourceCount: distinct.length, lastConfirmedAt: new Date(), observedAt: new Date() },
      });
    }

    const endChanged = (existing.endDate?.getTime() ?? null) !== (o.endDate?.getTime() ?? null);
    const confChanged = existing.confidence !== o.confidence;
    const newPct = o.ownershipPercent ?? null;
    const pctChanged = newPct !== null && Number(existing.percentage ?? NaN) !== newPct;

    // Phase 8 — source conflict: a NEW claim that an open-ended relationship has
    // ended, while another source confirmed it active recently. Don't overwrite;
    // park a SourceConflict for review.
    const CONFIRM_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;
    if (
      existing.endDate === null &&
      o.endDate !== null &&
      existing.lastConfirmedAt &&
      Date.now() - existing.lastConfirmedAt.getTime() < CONFIRM_WINDOW_MS &&
      !already
    ) {
      await ctx.db.sourceConflict.create({
        data: {
          relationshipId: existing.id,
          entityId: o.sourceEntityId,
          kind: "ended_vs_active",
          claimA: { text: "relationship still active (open-ended)", confirmedAt: existing.lastConfirmedAt.toISOString() },
          claimB: { text: `relationship ended ${o.endDate.toISOString().slice(0, 10)}`, sourceId: o.sourceId, sourceType: o.sourceType },
        },
      });
      ctx.log(`source conflict parked for relationship ${existing.id} (ended vs active)`);
      ctx.stats.updated++;
      return "unchanged";
    }

    if (endChanged || confChanged || pctChanged) {
      await ctx.db.relationship.update({
        where: { id: existing.id },
        data: {
          endDate: o.endDate,
          confidence: o.confidence,
          ...(pctChanged ? { percentage: newPct } : {}),
          lastVerifiedAt: new Date(),
          lastConfirmedAt: new Date(),
          observedAt: new Date(),
          temporalState: temporalOf(existing.status),
        },
      });
      await ctx.db.changeLog.create({
        data: {
          eventType: endChanged ? "RELATIONSHIP_ENDED" : "RELATIONSHIP_ADDED",
          entityId: o.sourceEntityId,
          relationshipId: existing.id,
          sourceId: o.sourceId,
          description: endChanged
            ? `Yhteyden päättymispäivä päivitetty: ${o.relationshipType}`
            : pctChanged
              ? `Omistusosuus päivitetty: ${o.relationshipType} (${newPct} %)`
              : `Yhteyden varmuustaso päivitetty: ${o.relationshipType}`,
          occurredAt: new Date(),
        },
      });
      ctx.stats.updated++;
      return "updated";
    }
    // No material change — but a source just re-confirmed the relationship holds.
    await ctx.db.relationship.update({
      where: { id: existing.id },
      data: { lastConfirmedAt: new Date(), observedAt: new Date() },
    });
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
      percentage: o.ownershipPercent ?? null,
      startDate: o.startDate,
      endDate: o.endDate,
      observedAt: new Date(),
      lastConfirmedAt: new Date(),
      temporalState: temporalOf("ACTIVE"),
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
    fundingTypeOverride?: FundingType | null;
    rawFundingType?: string | null;
    externalRecordId?: string | null;
    funderCountryCodeOverride?: string | null;
    recipientCountryCodeOverride?: string | null;
    projectId?: string | null;
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
  // Dedup: a stable per-source record id (multi-record sources like EU FTS) wins;
  // otherwise fall back to the coarse (payer, recipient, type, year) key.
  const existing = o.externalRecordId
    ? await ctx.db.financialFlow.findUnique({ where: { externalRecordId: o.externalRecordId } })
    : await ctx.db.financialFlow.findFirst({
        where: {
          payerEntityId: o.payerEntityId,
          recipientEntityId: o.recipientEntityId,
          flowType: o.flowType,
          periodYear: o.periodYear ?? null,
        },
      });
  if (existing) {
    // Attach this source's evidence to the same flow (corroboration).
    const already = await ctx.db.evidence.findFirst({
      where: { flowId: existing.id, sourceId: o.sourceId },
      select: { id: true },
    });
    if (!already) {
      await ctx.db.evidence.create({ data: { flowId: existing.id, sourceId: o.sourceId, confidence: o.confidence } });
      await ctx.db.financialFlow.update({ where: { id: existing.id }, data: { sourceCount: { increment: 1 } } });
    }
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
  // Sprint C — classify the flow by funder country.
  const [payer, recipient] = await Promise.all([
    ctx.db.entity.findUnique({ where: { id: o.payerEntityId }, select: { countryCode: true, country: true, jurisdiction: true } }),
    ctx.db.entity.findUnique({ where: { id: o.recipientEntityId }, select: { countryCode: true } }),
  ]);
  const cc = (e: { countryCode: string | null; country?: string | null; jurisdiction?: string | null } | null): string | null => {
    if (!e) return null;
    if (e.countryCode && /^[A-Z]{2}$/.test(e.countryCode)) return e.countryCode;
    const s = (e.country ?? e.jurisdiction ?? "").toUpperCase();
    if (s.startsWith("FI") || s === "SUOMI" || s === "FINLAND") return "FI";
    return null;
  };
  const funderCountryCode = o.funderCountryCodeOverride ?? cc(payer);
  const recipientCountryCode = o.recipientCountryCodeOverride ?? cc(recipient);
  const flow = await ctx.db.financialFlow.create({
    data: {
      payerEntityId: o.payerEntityId,
      recipientEntityId: o.recipientEntityId,
      amount: o.amount,
      currency: o.currency,
      flowType: o.flowType,
      fundingType: o.fundingTypeOverride ?? mapFundingType(o.flowType),
      rawFundingType: o.rawFundingType ?? null,
      externalRecordId: o.externalRecordId ?? null,
      projectId: o.projectId ?? null,
      funderCountryCode,
      recipientCountryCode,
      isForeign: Boolean(funderCountryCode) && funderCountryCode !== "FI",
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

// ---------------------------------------------------------------------------
// Benefit events (gifts / awards / honours / portraits / hospitality) — section 6
// ---------------------------------------------------------------------------
//
// Publication policy (section 18):
//   - An EXACT value from an official/audited source, extracted deterministically
//     → auto-published (PUBLISHED).
//   - Everything else (estimated/reported/calculated values, weaker sources,
//     LLM/manual extraction) → PENDING_REVIEW and shown to an admin in the
//     benefits review queue. No AI model may turn speculation into a published
//     benefit (section 30).

export interface BenefitPublicationResult {
  action: "created" | "updated" | "unchanged" | "rejected" | "review";
  reason?: string;
  entityIds: { recipient: string | null; giver: string | null };
}

const OFFICIAL_BENEFIT_SOURCE_TYPES = new Set<SourceType>([
  "OFFICIAL_PRIMARY",
  "OFFICIAL_REGISTER",
  "PARLIAMENTARY_RECORD",
  "COURT_DOCUMENT",
  "COMPANY_DISCLOSURE",
  "PROCUREMENT_RECORD",
  "ORGANIZATION_DISCLOSURE",
  "ANNUAL_REPORT",
]);

async function resolveBenefitParty(
  db: PrismaClient,
  ref: EntityRef | null | undefined,
): Promise<{ id: string | null; blocker?: string }> {
  if (!ref) return { id: null };
  const outcome = await resolveEntity(db, ref);
  if (outcome.status === "matched") return { id: outcome.entityId };
  if (outcome.status === "unresolved") return { id: null, blocker: `unresolved entity (candidate ${outcome.candidateId})` };
  return { id: null, blocker: outcome.reason };
}

export async function publishBenefitEvent(
  ctx: RunContext,
  fact: BenefitEventFact,
): Promise<BenefitPublicationResult> {
  const reject = (reason: string): BenefitPublicationResult => {
    ctx.stats.rejected++;
    return { action: "rejected", reason, entityIds: { recipient: null, giver: null } };
  };

  if (!fact.title || !fact.title.trim()) return reject("benefit without title");
  if (!fact.evidenceUrl) return reject("benefit without evidence URL");
  const hasParty = Boolean(fact.giver || fact.recipient || fact.payer || fact.beneficiary || fact.subject || fact.artist);
  if (!hasParty) return reject("benefit without any documented party");
  if (fact.monetaryValue !== null && fact.monetaryValue !== undefined) {
    if (!Number.isFinite(fact.monetaryValue) || Math.abs(fact.monetaryValue) > MAX_AMOUNT)
      return reject("benefit value out of bounds");
    if (!fact.currency) return reject("benefit value without currency");
  }
  if (fact.confidence === "LOW") return reject("LOW confidence not published by default");

  const parties = await Promise.all(
    ([
      ["giver", fact.giver],
      ["recipient", fact.recipient],
      ["payer", fact.payer],
      ["beneficiary", fact.beneficiary],
      ["subject", fact.subject],
      ["artist", fact.artist],
    ] as [string, EntityRef | null | undefined][]).map(async ([label, ref]) => ({
      label,
      ...(await resolveBenefitParty(ctx.db, ref)),
    })),
  );
  const partyIds: Record<string, string | null> = {};
  for (const p of parties) {
    if (p.blocker) return reject(`${p.label} ${p.blocker}`);
    partyIds[p.label] = p.id;
  }
  const giver = partyIds.giver;
  const recipient = partyIds.recipient;
  const payer = partyIds.payer;
  const beneficiary = partyIds.beneficiary;
  const subject = partyIds.subject;
  const artist = partyIds.artist;

  const evidenceSource = await ensureSource(ctx.db, {
    url: fact.evidenceUrl,
    name: fact.sourceName,
    publisher: fact.publisher,
    sourceType: fact.sourceType,
    documentTitle: fact.evidenceTitle ?? null,
  });

  // Auto-publish policy (section 18).
  const method = fact.extractionMethod ?? "deterministic-parser";
  const officialSource = OFFICIAL_BENEFIT_SOURCE_TYPES.has(fact.sourceType);
  const exactValue = fact.valueType === "EXACT" || fact.monetaryValue === null || fact.monetaryValue === undefined;
  const autoPublish = method === "deterministic-parser" && officialSource && exactValue;

  const existing = fact.dedupeKey
    ? await ctx.db.benefitEvent.findUnique({ where: { dedupeKey: fact.dedupeKey } })
    : null;
  if (existing) {
    await ctx.db.benefitEvent.update({
      where: { id: existing.id },
      data: { lastVerifiedAt: new Date() },
    });
    ctx.stats.updated++;
    return { action: "unchanged", entityIds: { recipient, giver } };
  }

  const reviewStatus = autoPublish ? "PUBLISHED" : "PENDING_REVIEW";
  const verificationStatus = autoPublish
    ? deriveAgentStatus({ sourceType: fact.sourceType, confidence: fact.confidence })
    : "AUTO_DETECTED";
  await ctx.db.benefitEvent.create({
    data: {
      eventType: fact.eventType,
      title: fact.title.trim(),
      description: fact.description ?? null,
      recipientEntityId: recipient,
      giverEntityId: giver,
      payerEntityId: payer,
      beneficiaryEntityId: beneficiary,
      subjectEntityId: subject,
      artistEntityId: artist,
      eventDate: fact.eventDate ?? null,
      startDate: fact.startDate ?? null,
      endDate: fact.endDate ?? null,
      monetaryValue: fact.monetaryValue ?? null,
      currency: fact.currency ?? null,
      valueType: fact.valueType,
      publicFundsUsed: fact.publicFundsUsed ?? null,
      country: fact.country ?? null,
      selectionRole: fact.selectionRole ?? null,
      verificationStatus,
      confidence: fact.confidence,
      confidenceScore: confidenceToScore(fact.confidence),
      reviewStatus,
      evidenceGrade: fact.evidenceGrade ?? "C",
      sourceId: evidenceSource.id,
      dedupeKey: fact.dedupeKey ?? null,
      createdBy: ctx.agentId,
      lastVerifiedAt: new Date(),
    },
  });
  if (autoPublish) {
    ctx.stats.created++;
    return { action: "created", entityIds: { recipient, giver } };
  }
  ctx.stats.candidates++;
  return { action: "review", entityIds: { recipient, giver } };
}

// ---------------------------------------------------------------------------
// Financial statement line items (section 3 & 43)
// ---------------------------------------------------------------------------

export type StatementPublicationResult = "created" | "updated" | "unchanged" | "rejected";

export async function publishStatementItem(
  ctx: RunContext,
  fact: StatementItemFact,
): Promise<StatementPublicationResult> {
  const reject = (reason: string): StatementPublicationResult => {
    void reason;
    ctx.stats.rejected++;
    return "rejected";
  };
  if (!fact.entity?.name) return reject("statement without entity");
  if (!fact.fiscalYear || fact.fiscalYear < 1900 || fact.fiscalYear > 2100) return reject("statement year out of bounds");
  if (!Number.isFinite(fact.amount) || Math.abs(fact.amount) > MAX_AMOUNT) return reject("statement amount out of bounds");
  if (!fact.currency) return reject("statement without currency");
  if (!fact.category || !fact.categoryLabel) return reject("statement without category");
  if (!fact.reportUrl) return reject("statement without report URL");

  const ent = await resolveEntity(ctx.db, fact.entity);
  if (ent.status === "unresolved") return reject(`unresolved entity (candidate ${ent.candidateId})`);
  if (ent.status === "rejected") return reject(ent.reason);

  const evidenceSource = await ensureSource(ctx.db, {
    url: fact.reportUrl,
    name: fact.sourceName,
    publisher: fact.publisher,
    sourceType: fact.sourceType,
    documentTitle: fact.evidenceTitle ?? null,
  });

  const existing = fact.dedupeKey
    ? await ctx.db.financialStatementItem.findUnique({ where: { dedupeKey: fact.dedupeKey } })
    : await ctx.db.financialStatementItem.findFirst({
        where: {
          entityId: ent.entityId,
          fiscalYear: fact.fiscalYear,
          kind: fact.statementKind,
          category: fact.category,
          reportUrl: fact.reportUrl,
        },
      });

  if (existing) {
    const changed =
      Number(existing.amount) !== fact.amount ||
      existing.categoryLabel !== fact.categoryLabel ||
      existing.valueType !== fact.valueType ||
      existing.isTotal !== Boolean(fact.isTotal) ||
      (existing.note ?? null) !== (fact.note ?? null);
    if (changed) {
      await ctx.db.financialStatementItem.update({
        where: { id: existing.id },
        data: {
          amount: fact.amount,
          categoryLabel: fact.categoryLabel,
          valueType: fact.valueType,
          isTotal: Boolean(fact.isTotal),
          note: fact.note ?? null,
          lastVerifiedAt: new Date(),
        },
      });
      ctx.stats.updated++;
      return "updated";
    }
    await ctx.db.financialStatementItem.update({
      where: { id: existing.id },
      data: { lastVerifiedAt: new Date() },
    });
    ctx.stats.updated++;
    return "unchanged";
  }

  await ctx.db.financialStatementItem.create({
    data: {
      entityId: ent.entityId,
      fiscalYear: fact.fiscalYear,
      kind: fact.statementKind,
      category: fact.category,
      categoryLabel: fact.categoryLabel,
      amount: fact.amount,
      currency: fact.currency,
      valueType: fact.valueType,
      isTotal: Boolean(fact.isTotal),
      note: fact.note ?? null,
      reportUrl: fact.reportUrl,
      sourceId: evidenceSource.id,
      dedupeKey: fact.dedupeKey ?? null,
      createdBy: ctx.agentId,
      lastVerifiedAt: new Date(),
    },
  });
  ctx.stats.created++;
  return "created";
}