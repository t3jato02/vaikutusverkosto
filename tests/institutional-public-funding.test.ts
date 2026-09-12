import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType, FlowType } from "@prisma/client";
import { publishVerifiedFact } from "@/lib/agents/publish";
import type { RunContext, NormalizedFact } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

function makeCtx(agentId = "pubinst-funding-test"): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: `${agentId}-${Date.now()}`, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
}

describe.skipIf(!db)("public-institutions funding (state grants) — provenance & idempotency", () => {
  const createdEntities: string[] = [];
  const createdFlows: string[] = [];

  async function trackEntityId(ref: { type: EntityType; name: string }): Promise<string | null> {
    const e = await db!.entity.findFirst({ where: { type: ref.type, canonicalName: ref.name } });
    if (e) createdEntities.push(e.id);
    return e?.id ?? null;
  }

  afterAll(async () => {
    if (!db) return;
    await db!.financialFlow.deleteMany({ where: { id: { in: createdFlows } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  function flowFact(extra: Partial<NormalizedFact> = {}): NormalizedFact {
    return {
      kind: "flow",
      source: { type: EntityType.GOVERNMENT_BODY, name: "Pubinst Valtio", jurisdiction: "FI" },
      target: { type: EntityType.ASSOCIATION, name: "Pubinst Järjestö", jurisdiction: "FI" },
      flowType: FlowType.PUBLIC_GRANT,
      fundingType: "GRANT",
      amount: 150000,
      currency: "EUR",
      periodYear: 2025,
      purpose: "Valtionavustus toimintaan",
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/state-grant",
      extractionMethod: "deterministic-parser",
      externalRecordId: "pubinst-grant-2025-001",
      ...extra,
    };
  }

  it("retains source + evidence and does not duplicate a flow on repeated ingestion", async () => {
    const ctx = makeCtx();
    const first = await publishVerifiedFact(ctx, {
      ...flowFact(),
      kind: "flow",
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Valtionavustusrekisteri",
      publisher: "Valtionvarainministeriö",
    });
    expect(first.action).toBe("created");
    const second = await publishVerifiedFact(ctx, {
      ...flowFact(),
      kind: "flow",
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Valtionavustusrekisteri",
      publisher: "Valtionvarainministeriö",
    });
    expect(second.action).toBe("unchanged");

    const payerId = await trackEntityId({ type: EntityType.GOVERNMENT_BODY, name: "Pubinst Valtio" });
    const recipientId = await trackEntityId({ type: EntityType.ASSOCIATION, name: "Pubinst Järjestö" });
    const flows = await db!.financialFlow.findMany({ where: { payerEntityId: payerId!, recipientEntityId: recipientId! } });
    expect(flows.length).toBe(1);
    createdFlows.push(flows[0].id);

    const evidence = await db!.evidence.findMany({ where: { flowId: flows[0].id }, include: { source: true } });
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].source.sourceUrl).toBe("https://example.fi/state-grant");
    expect(evidence[0].source.sourceName).toBe("Valtionavustusrekisteri");
  });

  it("rejects a flow without an amount or currency (data-quality guard)", async () => {
    const ctx = makeCtx();
    const res = await publishVerifiedFact(ctx, {
      ...flowFact(),
      kind: "flow",
      amount: null as unknown as number,
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Testi",
      publisher: "Testi",
    });
    expect(res.action).toBe("rejected");
  });
});