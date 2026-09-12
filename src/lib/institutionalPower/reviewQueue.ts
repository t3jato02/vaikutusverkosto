// Institutional review lane (public-institutions stream).
//
// Facts that did not meet the auto-publish bar are stored with
// verificationStatus = AUTO_DETECTED. This module exposes the queue for an
// admin (candidate fact + existing fact + source + dates + evidence grade +
// reason) and the human review action, mirroring the shared review model.

import { db } from "@/lib/db";
import type { VerificationStatus } from "@prisma/client";

export interface InstitutionalReviewItem {
  kind: "position" | "category" | "sector";
  id: string;
  personName: string | null;
  organizationName: string | null;
  role: string | null;
  category: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean | null;
  evidenceGrade: string;
  verificationStatus: VerificationStatus;
  sourceUrl: string | null;
  sourceName: string | null;
  reason: string;
  createdAt: Date;
}

function reasonFor(item: { verificationStatus: VerificationStatus; role?: string | null; category?: string | null }): string {
  if (item.verificationStatus !== "AUTO_DETECTED") return "ei tarkistusjonossa";
  if (item.category) return `heikko lähdenäyttö kategorialle (${item.category})`;
  return "heikko lähdenäyttö tehtävälle";
}

/** Candidate institutional facts awaiting human review (AUTO_DETECTED). */
export async function institutionalReviewQueue(limit = 100): Promise<InstitutionalReviewItem[]> {
  const [positions, categories, sectors] = await Promise.all([
    db.position.findMany({
      where: { verificationStatus: "AUTO_DETECTED" },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        personEntity: { select: { canonicalName: true } },
        organizationEntity: { select: { canonicalName: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
    }),
    db.organizationInstitutionalCategory.findMany({
      where: { evidenceGrade: { in: ["D", "E"] } },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        entity: { select: { canonicalName: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
    }),
    db.organizationSector.findMany({
      where: { evidenceGrade: { in: ["D", "E"] } },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        entity: { select: { canonicalName: true } },
        source: { select: { sourceUrl: true, sourceName: true } },
      },
    }),
  ]);

  return [
    ...positions.map((p) => ({
      kind: "position" as const,
      id: p.id,
      personName: p.personEntity.canonicalName,
      organizationName: p.organizationEntity?.canonicalName ?? null,
      role: p.role,
      category: null,
      startDate: p.startDate,
      endDate: p.endDate,
      isCurrent: p.isCurrent,
      evidenceGrade: p.evidenceGrade,
      verificationStatus: p.verificationStatus,
      sourceUrl: p.source?.sourceUrl ?? null,
      sourceName: p.source?.sourceName ?? null,
      reason: reasonFor(p),
      createdAt: p.createdAt,
    })),
    ...categories.map((c) => ({
      kind: "category" as const,
      id: c.id,
      personName: null,
      organizationName: c.entity.canonicalName,
      role: null,
      category: c.category,
      startDate: c.validFrom,
      endDate: c.validTo,
      isCurrent: c.validTo === null,
      evidenceGrade: c.evidenceGrade,
      verificationStatus: "AUTO_DETECTED" as VerificationStatus,
      sourceUrl: c.source?.sourceUrl ?? null,
      sourceName: c.source?.sourceName ?? null,
      reason: reasonFor({ verificationStatus: "AUTO_DETECTED", category: c.category }),
      createdAt: c.createdAt,
    })),
    ...sectors.map((s) => ({
      kind: "sector" as const,
      id: s.id,
      personName: null,
      organizationName: s.entity.canonicalName,
      role: null,
      category: s.sector,
      startDate: s.validFrom,
      endDate: s.validTo,
      isCurrent: s.validTo === null,
      evidenceGrade: s.evidenceGrade,
      verificationStatus: "AUTO_DETECTED" as VerificationStatus,
      sourceUrl: s.source?.sourceUrl ?? null,
      sourceName: s.source?.sourceName ?? null,
      reason: reasonFor({ verificationStatus: "AUTO_DETECTED", category: s.sector }),
      createdAt: s.createdAt,
    })),
  ].slice(0, limit);
}

/**
 * Human review of an institutional fact. Approving lifts an AUTO_DETECTED row
 * to HUMAN_VERIFIED — the only way that status may be reached. Disputing marks
 * it DISPUTED; rejecting REJECTED (never shown as a confirmed connection).
 */
export async function reviewInstitutionalFact(
  kind: "position" | "category" | "sector",
  id: string,
  action: "approve" | "reject" | "dispute",
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nextStatus: VerificationStatus = action === "approve" ? "HUMAN_VERIFIED" : action === "dispute" ? "DISPUTED" : "REJECTED";

  if (kind === "position") {
    const row = await db.position.findUnique({ where: { id }, select: { id: true, verificationStatus: true } });
    if (!row) return { ok: false, error: "not_found" };
    await db.$transaction([
      db.position.update({
        where: { id },
        data: { verificationStatus: nextStatus, lastVerifiedAt: new Date() },
      }),
      db.reviewAction.create({
        data: {
          targetType: "position",
          targetId: id,
          action,
          beforeData: { verificationStatus: row.verificationStatus },
          afterData: { verificationStatus: nextStatus },
          note: note?.slice(0, 2000) ?? null,
        },
      }),
    ]);
    return { ok: true };
  }

  if (kind === "category") {
    const row = await db.organizationInstitutionalCategory.findUnique({ where: { id }, select: { id: true, evidenceGrade: true } });
    if (!row) return { ok: false, error: "not_found" };
    await db.$transaction([
      db.organizationInstitutionalCategory.update({
        where: { id },
        data: { evidenceGrade: action === "approve" ? "A" : action === "dispute" ? "D" : "E", updatedAt: new Date() },
      }),
      db.reviewAction.create({
        data: {
          targetType: "institutional_category",
          targetId: id,
          action,
          beforeData: { evidenceGrade: row.evidenceGrade },
          afterData: { evidenceGrade: action === "approve" ? "A" : action === "dispute" ? "D" : "E" },
          note: note?.slice(0, 2000) ?? null,
        },
      }),
    ]);
    return { ok: true };
  }

  // sector
  const row = await db.organizationSector.findUnique({ where: { id }, select: { id: true, evidenceGrade: true } });
  if (!row) return { ok: false, error: "not_found" };
  await db.$transaction([
    db.organizationSector.update({
      where: { id },
      data: { evidenceGrade: action === "approve" ? "A" : action === "dispute" ? "D" : "E", updatedAt: new Date() },
    }),
    db.reviewAction.create({
      data: {
        targetType: "organization_sector",
        targetId: id,
        action,
        beforeData: { evidenceGrade: row.evidenceGrade },
        afterData: { evidenceGrade: action === "approve" ? "A" : action === "dispute" ? "D" : "E" },
        note: note?.slice(0, 2000) ?? null,
      },
    }),
  ]);
  return { ok: true };
}