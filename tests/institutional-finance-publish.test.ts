import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType } from "@prisma/client";
import { publishFinanceInstitution, publishScaleStatement, publishExternalIdentifier } from "@/lib/agents/publish";
import type { RunContext, FinanceInstitutionFact, ScaleStatementFact, ExternalIdentifierFact } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

function makeCtx(agentId = "finance-test-agent"): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: `${agentId}-${Date.now()}`, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
}

describe.skipIf(!db)("finance stream publication services", () => {
  const createdEntities: string[] = [];
  const createdProfiles: string[] = [];
  const createdScales: string[] = [];

  afterAll(async () => {
    if (!db) return;
    await db!.financeInstitutionProfile.deleteMany({ where: { id: { in: createdProfiles } } });
    await db!.institutionScaleStatement.deleteMany({ where: { id: { in: createdScales } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  function fact(extra: Partial<FinanceInstitutionFact>): FinanceInstitutionFact {
    return {
      kind: "finance-institution",
      organization: { type: EntityType.COMPANY, name: `Testi Pankki ${Date.now()}`, jurisdiction: "FI" },
      institutionType: "BANK",
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/finance-institution",
      sourceType: "OFFICIAL_PRIMARY",
      sourceName: "Testi lähde",
      publisher: "Testi julkaisija",
      extractionMethod: "deterministic-parser",
      ...extra,
    };
  }

  it("rejects a finance-institution fact without an evidence URL", async () => {
    const ctx = makeCtx();
    const res = await publishFinanceInstitution(ctx, fact({ evidenceUrl: "" }));
    expect(res.action).toBe("rejected");
    expect(ctx.stats.rejected).toBe(1);
  });

  it("publishes a SOURCE_CONFIRMED finance profile with LEI/BIC aliases", async () => {
    const ctx = makeCtx();
    const provider = `test-fin-${Date.now()}`;
    const f = fact({
      organization: { type: EntityType.COMPANY, name: `Testi Pankki ${provider}`, jurisdiction: "FI", externalId: { provider, identifier: "fi-1" } },
      lei: `LEITEST${Date.now()}`.slice(0, 20).padEnd(20, "0"),
      bic: `TESTFI${Date.now()}`.slice(0, 11).padEnd(11, "X"),
      aliases: ["Testi Pankki Aliaksi"],
    });
    const res = await publishFinanceInstitution(ctx, f);
    expect(res.action).toBe("created");

    const e = await db!.entity.findFirst({ where: { canonicalName: f.organization.name } });
    expect(e).not.toBeNull();
    createdEntities.push(e!.id);
    const profile = await db!.financeInstitutionProfile.findFirst({ where: { entityId: e!.id } });
    expect(profile).not.toBeNull();
    expect(profile!.institutionType).toBe("BANK");
    createdProfiles.push(profile!.id);

    const leiRow = await db!.externalIdentifier.findFirst({ where: { entityId: e!.id, provider: "gleif-lei" } });
    expect(leiRow).not.toBeNull();
    const bicRow = await db!.externalIdentifier.findFirst({ where: { entityId: e!.id, provider: "swift-bic" } });
    expect(bicRow).not.toBeNull();
    const alias = await db!.entityAlias.findFirst({ where: { entityId: e!.id, name: "Testi Pankki Aliaksi" } });
    expect(alias).not.toBeNull();

    await db!.externalIdentifier.deleteMany({ where: { entityId: e!.id } });
    await db!.entityAlias.deleteMany({ where: { entityId: e!.id } });
    await db!.externalIdentifier.deleteMany({ where: { provider } });
  });

  it("is idempotent — a second publish of the same profile is unchanged", async () => {
    const ctx = makeCtx();
    const provider = `test-fin-idem-${Date.now()}`;
    const f = fact({
      organization: { type: EntityType.COMPANY, name: `Idem Pankki ${provider}`, jurisdiction: "FI", externalId: { provider, identifier: "fi-2" } },
    });
    const a = await publishFinanceInstitution(ctx, f);
    const b = await publishFinanceInstitution(ctx, f);
    expect(a.action).toBe("created");
    expect(b.action).toBe("unchanged");
    const e = await db!.entity.findFirst({ where: { canonicalName: f.organization.name } });
    createdEntities.push(e!.id);
    const prof = await db!.financeInstitutionProfile.findFirst({ where: { entityId: e!.id } });
    createdProfiles.push(prof!.id);
    const count = await db!.financeInstitutionProfile.count({ where: { entityId: e!.id } });
    expect(count).toBe(1);
  });

  it("publishes a scale statement with year + source", async () => {
    const ctx = makeCtx();
    const s: ScaleStatementFact = {
      kind: "scale-statement",
      entity: { type: EntityType.COMPANY, name: `Testi Rahasto ${Date.now()}`, jurisdiction: "FI" },
      metricType: "ASSETS_UNDER_MANAGEMENT",
      value: 12340000000,
      currency: "EUR",
      year: 2025,
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/scale-statement",
      sourceType: "ANNUAL_REPORT",
      sourceName: "Testi vuosikertomus",
      publisher: "Testi",
      extractionMethod: "deterministic-parser",
      dedupeKey: `test-scale-${Date.now()}`,
    };
    const res = await publishScaleStatement(ctx, s);
    // Annual-report figures are self-disclosed → stored, but routed to the
    // review lane (AUTO_DETECTED), never auto-shown as confirmed.
    expect(res.action).toBe("review");
    const e = await db!.entity.findFirst({ where: { canonicalName: s.entity.name } });
    createdEntities.push(e!.id);
    const row = await db!.institutionScaleStatement.findFirst({ where: { entityId: e!.id } });
    expect(row).not.toBeNull();
    expect(Number(row!.value)).toBe(12340000000);
    expect(row!.year).toBe(2025);
    expect(row!.currency).toBe("EUR");
    expect(row!.verificationStatus).toBe("AUTO_DETECTED");
    createdScales.push(row!.id);
  });

  it("rejects a scale statement with a negative value", async () => {
    const ctx = makeCtx();
    const s: ScaleStatementFact = {
      kind: "scale-statement",
      entity: { type: EntityType.COMPANY, name: `Testi Neg ${Date.now()}`, jurisdiction: "FI" },
      metricType: "INVESTMENT_ASSETS",
      value: -5,
      currency: "EUR",
      year: 2025,
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/scale",
      sourceType: "ANNUAL_REPORT",
      sourceName: "Testi",
      publisher: "Testi",
    };
    const res = await publishScaleStatement(ctx, s);
    expect(res.action).toBe("rejected");
  });

  it("maps an external identifier deterministically", async () => {
    const ctx = makeCtx();
    const provider = `test-ext-${Date.now()}`;
    const id = `ID${Date.now()}`;
    const ef: ExternalIdentifierFact = {
      kind: "external-identifier",
      entity: { type: EntityType.COMPANY, name: `Testi Issuer ${Date.now()}`, jurisdiction: "FI" },
      provider,
      identifier: id,
      confidence: "HIGH",
      evidenceUrl: "https://example.fi/ext-id",
      sourceType: "OFFICIAL_REGISTER",
      sourceName: "Testi rekisteri",
      publisher: "Testi",
      extractionMethod: "deterministic-parser",
    };
    const res = await publishExternalIdentifier(ctx, ef);
    expect(res.action).toBe("created");
    const e = await db!.entity.findFirst({ where: { canonicalName: ef.entity.name } });
    createdEntities.push(e!.id);
    const row = await db!.externalIdentifier.findUnique({ where: { provider_identifier: { provider, identifier: id } } });
    expect(row).not.toBeNull();
    expect(row!.entityId).toBe(e!.id);
    await db!.externalIdentifier.deleteMany({ where: { provider } });
  });
});