// Admin review of identity facts & media mentions (luku 16).
// Only a human reviewer may PUBLISH an identity fact or accept a media-mention
// classification. Every action writes an immutable ReviewAction row.

import { db } from "@/lib/db";
import type { IdentityReviewStatus, Prisma } from "@prisma/client";

export type IdentityFactTable = "birth_origin" | "citizenship" | "residence" | "self_identification" | "identity_mention";
export type IdentityReviewAction = "approve" | "reject" | "dispute";

const NEXT_STATUS: Record<IdentityReviewAction, "PUBLISHED" | "REJECTED" | "DISPUTED"> = {
  approve: "PUBLISHED",
  reject: "REJECTED",
  dispute: "DISPUTED",
};

async function loadFactRow(table: IdentityFactTable, id: string) {
  switch (table) {
    case "birth_origin":
      return db.birthOriginFact.findUnique({ where: { id }, select: { id: true, personEntityId: true, reviewStatus: true, sourceUrl: true } });
    case "citizenship":
      return db.citizenshipFact.findUnique({ where: { id }, select: { id: true, personEntityId: true, reviewStatus: true, sourceUrl: true } });
    case "residence":
      return db.residenceFact.findUnique({ where: { id }, select: { id: true, personEntityId: true, reviewStatus: true, sourceUrl: true } });
    case "self_identification":
      return db.selfIdentificationFact.findUnique({ where: { id }, select: { id: true, personEntityId: true, reviewStatus: true, sourceUrl: true } });
    case "identity_mention":
      return db.mediaIdentityMention.findUnique({ where: { id }, select: { id: true, personEntityId: true, reviewStatus: true } });
  }
}

function updateFactRow(
  table: IdentityFactTable,
  id: string,
  status: IdentityReviewStatus,
  reviewedBy: string,
): Prisma.PrismaPromise<unknown> {
  const data = { reviewStatus: status, reviewedBy, reviewedAt: new Date() };
  switch (table) {
    case "birth_origin": return db.birthOriginFact.update({ where: { id }, data });
    case "citizenship": return db.citizenshipFact.update({ where: { id }, data });
    case "residence": return db.residenceFact.update({ where: { id }, data });
    case "self_identification": return db.selfIdentificationFact.update({ where: { id }, data });
    case "identity_mention": return db.mediaIdentityMention.update({ where: { id }, data });
  }
}

export async function reviewIdentityFact(
  table: IdentityFactTable,
  id: string,
  action: IdentityReviewAction,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadFactRow(table, id);
  if (!row) return { ok: false, error: "not_found" };
  if (row.reviewStatus === "PUBLISHED" || row.reviewStatus === "REJECTED") return { ok: false, error: "already_resolved" };

  const next = NEXT_STATUS[action];
  await db.$transaction([
    updateFactRow(table, id, next, "admin"),
    db.reviewAction.create({
      data: {
        targetType: `identity_fact:${table}`,
        targetId: id,
        action,
        beforeData: { reviewStatus: row.reviewStatus },
        afterData: { reviewStatus: next },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}

export interface IdentityReviewQueueItem {
  table: IdentityFactTable;
  id: string;
  label: string;
  personName: string;
  value: string;
  sourceUrl: string | null;
  sourceName: string | null;
  evidenceGrade: string | null;
  confidence: string | null;
  createdAt: Date;
  detail: string | null;
}

/** Rows waiting for human review (PENDING_REVIEW / DISPUTED). */
export async function listIdentityReviewQueue(limit = 60): Promise<IdentityReviewQueueItem[]> {
  const statuses = ["PENDING_REVIEW", "DISPUTED"] as IdentityReviewStatus[];
  const [birth, citizenships, residences, selfIds, mentions] = await Promise.all([
    db.birthOriginFact.findMany({ where: { reviewStatus: { in: statuses } }, take: limit, orderBy: { createdAt: "asc" }, include: { personEntity: { select: { canonicalName: true } } } }),
    db.citizenshipFact.findMany({ where: { reviewStatus: { in: statuses } }, take: limit, orderBy: { createdAt: "asc" }, include: { personEntity: { select: { canonicalName: true } } } }),
    db.residenceFact.findMany({ where: { reviewStatus: { in: statuses } }, take: limit, orderBy: { createdAt: "asc" }, include: { personEntity: { select: { canonicalName: true } } } }),
    db.selfIdentificationFact.findMany({ where: { reviewStatus: { in: statuses } }, take: limit, orderBy: { createdAt: "asc" }, include: { personEntity: { select: { canonicalName: true } } } }),
    db.mediaIdentityMention.findMany({
      where: { reviewStatus: { in: statuses } },
      take: limit,
      orderBy: { createdAt: "asc" },
      include: { personEntity: { select: { canonicalName: true } }, article: { select: { title: true, canonicalUrl: true } } },
    }),
  ]);

  const items: IdentityReviewQueueItem[] = [];
  for (const b of birth) {
    items.push({
      table: "birth_origin", id: b.id,
      label: b.factKind === "BIRTH_COUNTRY" ? "Syntymämaa" : "Syntymäpaikka",
      personName: b.personEntity.canonicalName,
      value: b.displayValue, sourceUrl: b.sourceUrl, sourceName: b.sourceName,
      evidenceGrade: b.evidenceGrade, confidence: b.confidence, createdAt: b.createdAt,
      detail: `Kohde: ${b.value}${b.note ? ` · ${b.note}` : ""}`,
    });
  }
  for (const c of citizenships) {
    items.push({
      table: "citizenship", id: c.id,
      label: "Kansalaisuus",
      personName: c.personEntity.canonicalName,
      value: c.countryName, sourceUrl: c.sourceUrl, sourceName: c.sourceName,
      evidenceGrade: c.evidenceGrade, confidence: c.confidence, createdAt: c.createdAt,
      detail: `Status: ${c.status}${c.acquiredYear ? ` · alkaen ${c.acquiredYear}` : ""}`,
    });
  }
  for (const r of residences) {
    items.push({
      table: "residence", id: r.id,
      label: "Asuinmaa",
      personName: r.personEntity.canonicalName,
      value: r.countryName ?? r.municipality ?? "—", sourceUrl: r.sourceUrl, sourceName: r.sourceName,
      evidenceGrade: r.evidenceGrade, confidence: r.confidence, createdAt: r.createdAt,
      detail: `${r.countryCode ?? "?"}${r.municipality ? ` · ${r.municipality}` : ""}${r.isCurrent ? " · nykyinen" : ""}`,
    });
  }
  for (const s of selfIds) {
    items.push({
      table: "self_identification", id: s.id,
      label: "Henkilön oma identiteetti",
      personName: s.personEntity.canonicalName,
      value: s.identityLabel, sourceUrl: s.sourceUrl, sourceName: s.sourceName,
      evidenceGrade: s.evidenceGrade, confidence: s.confidence, createdAt: s.createdAt,
      detail: `Lainaus: “${s.verbatimText.slice(0, 120)}”`,
    });
  }
  for (const m of mentions) {
    items.push({
      table: "identity_mention", id: m.id,
      label: "Media-ilmaus",
      personName: m.personEntity.canonicalName,
      value: m.expression, sourceUrl: m.article?.canonicalUrl ?? null, sourceName: m.article?.title ?? null,
      evidenceGrade: null, confidence: m.confidence.toFixed(2), createdAt: m.createdAt,
      detail: `Luokka: ${m.termCategory}${m.context ? ` · “${m.context.slice(0, 90)}…”` : ""}`,
    });
  }
  return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
}