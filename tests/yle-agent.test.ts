import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { yleAdapter } from "@/lib/agents/yle";
import { awardAdapter, PRIZE_EUR } from "@/lib/agents/awards";
import { runAgent } from "@/lib/agents/pipeline";
import { sumStatementItems } from "@/lib/financial";
import type { RunContext } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
const ctx = { log: () => {}, stats: {} } as unknown as RunContext;

describe("YleAgent — manifest facts (unit)", () => {
  it("discovers the profile, leadership, governance and one finance document per year", async () => {
    const docs = await yleAdapter.discover(ctx);
    const ids = docs.map((d) => d.id);
    expect(ids).toContain("yle-profile");
    expect(ids).toContain("yle-leadership");
    expect(ids).toContain("yle-governance");
    expect(ids.filter((i) => i.startsWith("yle-finances-")).length).toBeGreaterThanOrEqual(3);
  });

  it("emits an evidenced state-ownership fact with 99.98 %", async () => {
    const docs = await yleAdapter.discover(ctx);
    const profileDoc = docs.find((d) => d.id === "yle-profile")!;
    const raw = await yleAdapter.fetch(ctx, profileDoc);
    const facts = await yleAdapter.parse(ctx, profileDoc, raw);
    const ownership = facts.find((f) => f.kind === "relationship" && f.relationshipType === "OWNS");
    expect(ownership).toBeDefined();
    expect((ownership as { ownershipPercent?: number }).ownershipPercent).toBe(99.98);
    expect((ownership as { evidenceUrl: string }).evidenceUrl).toContain("yle.fi");
  });

  it("emits statement items whose categories sum without double counting", async () => {
    const docs = await yleAdapter.discover(ctx);
    const fin = docs.find((d) => d.id === "yle-finances-2025")!;
    const raw = await yleAdapter.fetch(ctx, fin);
    const facts = await yleAdapter.parse(ctx, fin, raw);
    const items = facts.filter((f) => f.kind === "statement");
    expect(items.length).toBeGreaterThan(10);
    const ex = items.filter((f) => f.kind === "statement" && f.statementKind === "EXPENDITURE").map((f) => ({
      kind: f.statementKind,
      amount: f.amount,
      isTotal: f.isTotal ?? false,
      category: f.category,
    }));
    const { total } = sumStatementItems(ex, "EXPENDITURE");
    // 2025 category rows sum to 528.9 M€ — the audited total.
    expect(total).toBeCloseTo(528_900_000, -4);
  });

  it("emits a state-appropriation flow per year where the appropriation is documented", async () => {
    const docs = await yleAdapter.discover(ctx);
    const fin = docs.find((d) => d.id === "yle-finances-2024")!;
    const raw = await yleAdapter.fetch(ctx, fin);
    const facts = await yleAdapter.parse(ctx, fin, raw);
    const flow = facts.find((f) => f.kind === "flow");
    expect(flow).toBeDefined();
    expect((flow as { flowType: string }).flowType).toBe("GOVERNMENT_SUBSIDY");
    expect((flow as { periodYear: number }).periodYear).toBe(2024);
  });
});

describe("AwardAgent — manifest facts (unit)", () => {
  it("emits an award per documented winner with a 10 000 € prize", async () => {
    const docs = await awardAdapter.discover(ctx);
    const doc = docs.find((d) => d.id === "awards-journalist-of-year")!;
    const raw = await awardAdapter.fetch(ctx, doc);
    const facts = await awardAdapter.parse(ctx, doc, raw);
    expect(facts.length).toBeGreaterThanOrEqual(25);
    const iida = facts.find((f) => f.kind === "benefit" && (f as { recipient?: { name: string } }).recipient?.name === "Iida Tikka");
    expect(iida).toBeDefined();
    expect((iida as { monetaryValue: number }).monetaryValue).toBe(PRIZE_EUR);
    expect((iida as { valueType: string }).valueType).toBe("EXACT");
    expect((iida as { selectionRole: string }).selectionRole).toBe("winner");
  });

  it("every award carries a real evidence URL and a stable dedupe key", async () => {
    const docs = await awardAdapter.discover(ctx);
    for (const doc of docs) {
      const raw = await awardAdapter.fetch(ctx, doc);
      const facts = await awardAdapter.parse(ctx, doc, raw);
      for (const f of facts) {
        expect(f.kind).toBe("benefit");
        const b = f as { evidenceUrl: string; dedupeKey: string };
        expect(b.evidenceUrl).toMatch(/^https?:\/\//);
        expect(b.dedupeKey).toBeTruthy();
      }
    }
  });
});

describe("idempotency — the same ingestion never duplicates (section 40)", () => {
  it.skipIf(!db)("YleAgent second run creates zero new records", async () => {
    const first = await runAgent(yleAdapter, { concurrency: 2 });
    expect(["SUCCESS", "PARTIAL"]).toContain(first.status);
    const countsBefore = await captureYle(db as PrismaClient);
    const second = await runAgent(yleAdapter, { concurrency: 2 });
    expect(["SUCCESS", "PARTIAL"]).toContain(second.status);
    const countsAfter = await captureYle(db as PrismaClient);
    expect(countsAfter).toEqual(countsBefore);
  }, 120_000);

  it.skipIf(!db)("AwardAgent second run creates zero new records", async () => {
    await runAgent(awardAdapter, { concurrency: 2 });
    const before = await (db as PrismaClient).benefitEvent.count();
    await runAgent(awardAdapter, { concurrency: 2 });
    const after = await (db as PrismaClient).benefitEvent.count();
    expect(after).toBe(before);
  }, 120_000);
});

async function captureYle(db: PrismaClient) {
  const yle = await db.entity.findFirst({ where: { canonicalName: "Yleisradio Oy", type: "MEDIA_ORGANIZATION" }, select: { id: true } });
  if (!yle) return { rels: -1, flows: -1, stmts: -1 };
  return {
    rels: await db.relationship.count({ where: { OR: [{ sourceEntityId: yle.id }, { targetEntityId: yle.id }] } }),
    flows: await db.financialFlow.count({ where: { recipientEntityId: yle.id } }),
    stmts: await db.financialStatementItem.count({ where: { entityId: yle.id } }),
  };
}