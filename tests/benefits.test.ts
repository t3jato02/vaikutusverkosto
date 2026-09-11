import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType, SourceType, BenefitEventType } from "@prisma/client";
import { publishBenefitEvent } from "@/lib/agents/publish";
import { benefitEventTypeLabel, valuePrecisionLabel, selectionRoleLabel, PUBLIC_BENEFIT_STATUSES } from "@/lib/benefits";
import { sumStatementItems } from "@/lib/financial";
import type { BenefitEventFact, RunContext } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

function mkCtx(): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return {
    runId: "test-run",
    agentId: "test-agent",
    sourceId: "test-source",
    db: db as never,
    stats,
    log: () => {},
  };
}

const baseBenefit = {
  kind: "benefit" as const,
  eventType: BenefitEventType.AWARD,
  title: "Testipalkinto 2024",
  giver: { type: EntityType.ASSOCIATION, name: "Palkitsijayhdistys ry", jurisdiction: "FI" },
  recipient: { type: EntityType.PERSON, name: "Testi Henkilö", jurisdiction: "FI" },
  monetaryValue: 10000,
  currency: "EUR",
  valueType: "EXACT" as const,
  country: "FI",
  selectionRole: "winner",
  confidence: "HIGH" as const,
  evidenceUrl: "https://example.fi/award-2024",
  sourceType: SourceType.REPUTABLE_MEDIA,
  sourceName: "Esimerkkipalkinto",
  publisher: "Esimerkkijulkaisija",
  extractionMethod: "deterministic-parser",
  evidenceGrade: "B" as const,
  dedupeKey: "award:test:2024:winner",
};

describe("benefit labels & value precision (section 6)", () => {
  it("labels every benefit type", () => {
    const types: BenefitEventType[] = ["GIFT", "AWARD", "HONOUR", "DECORATION", "PORTRAIT", "TRAVEL", "ACCOMMODATION", "HOSPITALITY", "EVENT_TICKET", "MEAL", "PRIZE", "SPONSORED_TRIP", "COMMISSIONED_WORK", "OTHER"];
    for (const t of types) {
      expect(benefitEventTypeLabel(t)).not.toBe(t);
      expect(benefitEventTypeLabel(t).length).toBeGreaterThan(0);
    }
  });

  it("labels every value precision and never blurs estimate with exact", () => {
    expect(valuePrecisionLabel("EXACT")).not.toBe(valuePrecisionLabel("ESTIMATED"));
    expect(valuePrecisionLabel("ESTIMATED")).toContain("Arvio");
  });

  it("keeps award roles distinct (winner / selection / jury)", () => {
    expect(selectionRoleLabel("winner")).not.toBe(selectionRoleLabel("jury"));
    expect(selectionRoleLabel("selection")).not.toBe(selectionRoleLabel("winner"));
  });

  it("only PUBLISHED benefit events are publicly visible", () => {
    expect(PUBLIC_BENEFIT_STATUSES).toEqual(["PUBLISHED"]);
  });
});

describe("sumStatementItems — no double counting (section 43)", () => {
  it("prefers the grand-total row when present", () => {
    const rows = [
      { kind: "EXPENDITURE", amount: 262.1, isTotal: false, category: "PERSONNEL_COSTS" },
      { kind: "EXPENDITURE", amount: 528.9, isTotal: true, category: "TOTAL_EXPENSES" },
    ];
    const { total } = sumStatementItems(rows, "EXPENDITURE");
    expect(total).toBe(528.9);
  });

  it("never sums a parent together with its children", () => {
    const rows = [
      { kind: "EXPENDITURE", amount: 262.1, isTotal: false, category: "PERSONNEL_COSTS" },
      { kind: "EXPENDITURE", amount: 188.0, isTotal: false, category: "PERSONNEL_WAGES" },
      { kind: "EXPENDITURE", amount: 8.2, isTotal: false, category: "PERSONNEL_FEES" },
    ];
    const { total } = sumStatementItems(rows, "EXPENDITURE");
    expect(total).toBe(262.1); // children dropped — parent total already includes them
  });

  it("sums leaves when no parent row is present", () => {
    const rows = [
      { kind: "INCOME", amount: 100, isTotal: false, category: "YLE_APPROPRIATION" },
      { kind: "INCOME", amount: 20, isTotal: false, category: "OTHER_INCOME" },
    ];
    const { total } = sumStatementItems(rows, "INCOME");
    expect(total).toBe(120);
  });
});

describe("benefit publication policy (section 18 & 30)", () => {
  const runKey = `test-${Date.now()}`;

  it.skipIf(!db)("rejects a benefit without any documented party", async () => {
    const r = await publishBenefitEvent(mkCtx(), { ...baseBenefit, giver: null, recipient: null } as BenefitEventFact);
    expect(r.action).toBe("rejected");
  });

  it.skipIf(!db)("rejects a benefit with a value but no currency", async () => {
    const r = await publishBenefitEvent(mkCtx(), { ...baseBenefit, currency: undefined } as BenefitEventFact);
    expect(r.action).toBe("rejected");
  });

  it.skipIf(!db)("a secondary (non-official) source routes to the review queue, never auto-publishes", async () => {
    const ctx = mkCtx();
    const key = `award:${runKey}:review`;
    const r = await publishBenefitEvent(ctx, { ...baseBenefit, dedupeKey: key } as BenefitEventFact);
    expect(r.action).toBe("review");
    const row = await (db as PrismaClient).benefitEvent.findUnique({ where: { dedupeKey: key } });
    expect(row?.reviewStatus).toBe("PENDING_REVIEW");
    expect(row?.verificationStatus).toBe("AUTO_DETECTED");
  });

  it.skipIf(!db)("an official source with an EXACT value auto-publishes", async () => {
    const key = `award:${runKey}:official`;
    const r = await publishBenefitEvent(mkCtx(), {
      ...baseBenefit,
      dedupeKey: key,
      sourceType: SourceType.OFFICIAL_REGISTER,
      evidenceGrade: "A",
    } as BenefitEventFact);
    expect(r.action).toBe("created");
    const row = await (db as PrismaClient).benefitEvent.findUnique({ where: { dedupeKey: key } });
    expect(row?.reviewStatus).toBe("PUBLISHED");
    expect(row?.verificationStatus).toBe("SOURCE_CONFIRMED");
  });

  it.skipIf(!db)("a duplicate run is idempotent — no new rows", async () => {
    const ctx = mkCtx();
    const key = `award:${runKey}:official`;
    const before = await (db as PrismaClient).benefitEvent.count({ where: { dedupeKey: key } });
    const r = await publishBenefitEvent(ctx, {
      ...baseBenefit,
      dedupeKey: key,
      sourceType: SourceType.OFFICIAL_REGISTER,
    } as BenefitEventFact);
    expect(r.action).toBe("unchanged");
    const after = await (db as PrismaClient).benefitEvent.count({ where: { dedupeKey: key } });
    expect(after).toBe(before);
    expect(after).toBe(1);
    // Cleanup — these are test rows, not production data.
    await (db as PrismaClient).benefitEvent.deleteMany({ where: { dedupeKey: { contains: runKey } } });
  });
});