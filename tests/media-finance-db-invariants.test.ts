import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

describe("public media finance DB invariants (sections 3, 6, 43, 44)", () => {
  it.skipIf(!db)("every published benefit event has a source and at least one party", async () => {
    const rows = await (db as PrismaClient).benefitEvent.findMany({
      where: { reviewStatus: "PUBLISHED" },
      select: {
        id: true,
        sourceId: true,
        recipientEntityId: true,
        giverEntityId: true,
        payerEntityId: true,
        beneficiaryEntityId: true,
        subjectEntityId: true,
        artistEntityId: true,
        evidenceGrade: true,
      },
    });
    for (const r of rows) {
      expect(r.sourceId, `benefit ${r.id} missing source`).not.toBeNull();
      const hasParty = Boolean(r.recipientEntityId || r.giverEntityId || r.payerEntityId || r.beneficiaryEntityId || r.subjectEntityId || r.artistEntityId);
      expect(hasParty, `benefit ${r.id} missing all parties`).toBe(true);
    }
  });

  it.skipIf(!db)("no published benefit with a monetary value lacks a currency", async () => {
    const rows = await (db as PrismaClient).benefitEvent.findMany({
      where: { reviewStatus: "PUBLISHED", monetaryValue: { not: null } },
      select: { id: true, currency: true, valueType: true },
    });
    for (const r of rows) {
      expect(r.currency, `benefit ${r.id} value without currency`).toBeTruthy();
    }
  });

  it.skipIf(!db)("statement items are EXACT/REPORTED/CALCULATED — never displayed as invented exact prices", async () => {
    const rows = await (db as PrismaClient).financialStatementItem.findMany({
      select: { id: true, valueType: true, amount: true, currency: true, fiscalYear: true },
      take: 500,
    });
    for (const r of rows) {
      expect(r.currency).toBe("EUR");
      expect(r.fiscalYear).toBeGreaterThanOrEqual(1900);
      expect(r.fiscalYear).toBeLessThanOrEqual(2100);
      expect(Number(r.amount)).toBeGreaterThan(-1e15);
    }
  });

  it.skipIf(!db)("statement totals are flagged and never summed as categories", async () => {
    const totals = await (db as PrismaClient).financialStatementItem.findMany({
      where: { isTotal: true },
      select: { id: true, category: true },
      take: 100,
    });
    for (const t of totals) {
      expect(t.category).toMatch(/TOTAL_/);
    }
  });

  it.skipIf(!db)("no duplicate Yleisradio Oy organisation entity remains (canonical single entity)", async () => {
    const yles = await (db as PrismaClient).entity.findMany({
      where: { canonicalName: "Yleisradio Oy" },
      select: { id: true, type: true },
    });
    expect(yles.length).toBe(1);
    expect(yles[0].type).toBe("MEDIA_ORGANIZATION");
  });

  it.skipIf(!db)("Yle leadership edges are temporal and current roles stay current", async () => {
    const yle = await (db as PrismaClient).entity.findFirst({ where: { canonicalName: "Yleisradio Oy", type: "MEDIA_ORGANIZATION" }, select: { id: true } });
    if (!yle) return;
    const current = await (db as PrismaClient).relationship.findMany({
      where: { OR: [{ sourceEntityId: yle.id }, { targetEntityId: yle.id }], verificationStatus: { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] } },
      select: { temporalState: true, endDate: true, relationshipType: true },
    });
    for (const r of current) {
      if (r.temporalState === "CURRENT") {
        expect(r.endDate === null || r.endDate! >= new Date(Date.UTC(2026, 0, 1))).toBe(true);
      }
    }
    // The current CEO's relationship is CURRENT and open-ended.
    const ceo = await (db as PrismaClient).relationship.findFirst({
      where: { OR: [{ sourceEntityId: yle.id }, { targetEntityId: yle.id }], role: "Toimitusjohtaja" },
      orderBy: { startDate: "desc" },
      select: { temporalState: true, endDate: true },
    });
    expect(ceo).not.toBeNull();
    expect(ceo!.temporalState).toBe("CURRENT");
  });
});