import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient, EntityType } from "@prisma/client";
import {
  publishRoleAssignment,
  publishOrganizationSector,
  publishCriticalFunction,
  publishProcurement,
  publishLobbying,
} from "@/lib/agents/publish";
import type { RunContext, RoleAssignmentFact, OrganizationSectorFact, CriticalFunctionFact, ProcurementFact, LobbyingFact } from "@/lib/agents/types";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

let runId = "test";
let stats: RunContext["stats"];

function makeCtx(agentId = "foundation-test-agent"): RunContext {
  runId = `${agentId}-${Date.now()}`;
  stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId, agentId, sourceId: "test-source", db: db!, stats, log: () => {} };
}

const OFFICIAL = {
  sourceType: "OFFICIAL_REGISTER" as const,
  sourceName: "Testi lähde",
  publisher: "Testi julkaisija",
  confidence: "HIGH" as const,
};

function roleFact(person: string, org: string, extra: Partial<RoleAssignmentFact> = {}): RoleAssignmentFact {
  return {
    kind: "role",
    person: { type: EntityType.PERSON, name: person, jurisdiction: "FI" },
    organization: { type: EntityType.ORGANIZATION, name: org, jurisdiction: "FI" },
    role: "Testirooli",
    ...OFFICIAL,
    evidenceUrl: "https://example.fi/institutional-role",
    ...extra,
  };
}

describe.skipIf(!db)("institutional-power publication service (foundation, section 3-6, 10-11)", () => {
  const createdEntities: string[] = [];
  const createdRoles: string[] = [];
  const createdSectors: string[] = [];
  const createdFunctions: string[] = [];
  const createdProcurements: string[] = [];
  const createdLobbying: string[] = [];

  async function trackEntityId(ref: { type: EntityType; name: string }): Promise<string | null> {
    const e = await db!.entity.findFirst({ where: { type: ref.type, canonicalName: ref.name } });
    if (e) createdEntities.push(e.id);
    return e?.id ?? null;
  }

  afterAll(async () => {
    if (!db) return;
    await db!.position.deleteMany({ where: { id: { in: createdRoles } } });
    await db!.organizationSector.deleteMany({ where: { id: { in: createdSectors } } });
    await db!.criticalFunctionAssignment.deleteMany({ where: { id: { in: createdFunctions } } });
    await db!.procurementContract.deleteMany({ where: { id: { in: createdProcurements } } });
    await db!.lobbyingEngagement.deleteMany({ where: { id: { in: createdLobbying } } });
    await db!.entity.deleteMany({ where: { id: { in: createdEntities } } });
  });

  it("requires a source (evidence URL) for a role", async () => {
    const ctx = makeCtx();
    const res = await publishRoleAssignment(ctx, roleFact("Testi Viranhaltija", "Testi Org Oy", { evidenceUrl: "" }));
    expect(res.action).toBe("rejected");
    expect(ctx.stats.rejected).toBe(1);
  });

  it("parks an unresolved person (entity resolution) instead of guessing", async () => {
    const ctx = makeCtx();
    // Two distinct same-name people → a name-only ref is UNRESOLVED.
    const provider = `test-ip-${Date.now()}`;
    // Clean any residue from earlier (possibly failed) runs.
    await db!.entityResolutionCandidate.deleteMany({ where: { refName: "Testi Kaksoisolento" } });
    await db!.position.deleteMany({ where: { personEntity: { canonicalName: "Testi Kaksoisolento" } } });
    await db!.entity.deleteMany({ where: { canonicalName: { in: ["Testi Kaksoisolento", "Testi Org Oy"] } } });
    const a = await db!.entity.create({
      data: { type: EntityType.PERSON, canonicalName: "Testi Kaksoisolento", jurisdiction: "FI", externalIds: { create: { provider, identifier: "a" } } },
    });
    const b = await db!.entity.create({
      data: { type: EntityType.PERSON, canonicalName: "Testi Kaksoisolento", jurisdiction: "FI", externalIds: { create: { provider, identifier: "b" } } },
    });
    createdEntities.push(a.id, b.id);

    const res = await publishRoleAssignment(ctx, {
      kind: "role",
      person: { type: EntityType.PERSON, name: "Testi Kaksoisolento", jurisdiction: "FI" },
      organization: { type: EntityType.ORGANIZATION, name: "Testi Org Oy" },
      role: "Toimitusjohtaja",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/role",
    });
    expect(res.action).toBe("rejected");
    await db!.externalIdentifier.deleteMany({ where: { provider } });
    await db!.entityResolutionCandidate.deleteMany({ where: { refName: "Testi Kaksoisolento" } });
  });

  it("publishes a SOURCE_CONFIRMED role with an evidence grade from an official source", async () => {
    const ctx = makeCtx();
    const res = await publishRoleAssignment(ctx, roleFact("Testi Johtaja", "Testi Infra Oy", { roleType: "CEO" }));
    expect(res.action).toBe("created");
    const orgId = await trackEntityId({ type: EntityType.ORGANIZATION, name: "Testi Infra Oy" });
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Testi Johtaja" });
    expect(orgId).not.toBeNull();
    const pos = await db!.position.findFirst({ where: { personEntityId: personId!, organizationEntityId: orgId!, role: "Testirooli" } });
    expect(pos).not.toBeNull();
    expect(pos!.roleType).toBe("CEO");
    expect(pos!.evidenceGrade).toBe("C");
    expect(pos!.verificationStatus).toBe("SOURCE_CONFIRMED");
    createdRoles.push(pos!.id);
  });

  it("allows MULTIPLE SIMULTANEOUS roles for one person", async () => {
    const ctx = makeCtx();
    await publishRoleAssignment(ctx, roleFact("Testi Monitoimi", "Testi Yhtiö A", { role: "Hallituksen jäsen", roleType: "BOARD_MEMBER" }));
    await publishRoleAssignment(ctx, roleFact("Testi Monitoimi", "Testi Säätiö B", { role: "Hallituksen puheenjohtaja", roleType: "BOARD_CHAIR" }));
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Testi Monitoimi" });
    const count = await db!.position.count({ where: { personEntityId: personId! } });
    expect(count).toBe(2);
    const roles = await db!.position.findMany({ where: { personEntityId: personId! } });
    createdRoles.push(...roles.map((r) => r.id));
  });

  it("marks a role with a past end date as HISTORICAL (isCurrent=false)", async () => {
    const ctx = makeCtx();
    const past = new Date("2020-01-01");
    const res = await publishRoleAssignment(ctx, roleFact("Testi Entinen", "Testi Org Oy", { role: "Ministeri", roleType: "MINISTER", startDate: past, endDate: new Date("2020-12-31") }));
    expect(res.action).toBe("created");
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Testi Entinen" });
    const pos = await db!.position.findFirst({ where: { personEntityId: personId!, role: "Ministeri" } });
    expect(pos!.isCurrent).toBe(false);
    createdRoles.push(pos!.id);
  });

  it("deduplicates the same role fact (idempotent upsert)", async () => {
    const ctx = makeCtx();
    const fact = roleFact("Testi Dedup", "Testi Org Oy", { roleType: "EXECUTIVE" });
    const first = await publishRoleAssignment(ctx, fact);
    expect(first.action).toBe("created");
    const second = await publishRoleAssignment(ctx, { ...fact, evidenceUrl: "https://example.fi/institutional-role" });
    expect(second.action).toBe("unchanged");
    const personId = await trackEntityId({ type: EntityType.PERSON, name: "Testi Dedup" });
    const count = await db!.position.count({ where: { personEntityId: personId! } });
    expect(count).toBe(1);
    const pos = await db!.position.findFirst({ where: { personEntityId: personId! } });
    createdRoles.push(pos!.id);
  });

  it("publishes an organisation sector and deduplicates by (entity, sector)", async () => {
    const ctx = makeCtx();
    const fact: OrganizationSectorFact = {
      kind: "sector",
      organization: { type: EntityType.ORGANIZATION, name: "Testi Energia Oy", jurisdiction: "FI" },
      sector: "ELECTRICITY_TRANSMISSION",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/sector",
    };
    expect((await publishOrganizationSector(ctx, fact)).action).toBe("created");
    expect((await publishOrganizationSector(ctx, fact)).action).toBe("unchanged");
    const orgId = await trackEntityId({ type: EntityType.ORGANIZATION, name: "Testi Energia Oy" });
    const rows = await db!.organizationSector.findMany({ where: { entityId: orgId!, sector: "ELECTRICITY_TRANSMISSION" } });
    expect(rows.length).toBe(1);
    createdSectors.push(...rows.map((r) => r.id));
  });

  it("requires a public basis for a critical-function label", async () => {
    const ctx = makeCtx();
    const res = await publishCriticalFunction(ctx, {
      kind: "critical-function",
      organization: { type: EntityType.ORGANIZATION, name: "Testi Verkko Oy" },
      function: "NATIONAL_GRID",
      classificationSource: "foundation-test",
      publicBasis: "",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/critical",
    });
    expect(res.action).toBe("rejected");
  });

  it("publishes a critical function with a public basis only", async () => {
    const ctx = makeCtx();
    const fact: CriticalFunctionFact = {
      kind: "critical-function",
      organization: { type: EntityType.ORGANIZATION, name: "Testi Verkko Oy" },
      function: "NATIONAL_GRID",
      classificationSource: "foundation-test",
      publicBasis: "Kantaverkonhaltijan asema (laki sähkömarkkinoista).",
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/critical",
    };
    expect((await publishCriticalFunction(ctx, fact)).action).toBe("created");
    const orgId = await trackEntityId({ type: EntityType.ORGANIZATION, name: "Testi Verkko Oy" });
    const rows = await db!.criticalFunctionAssignment.findMany({ where: { entityId: orgId! } });
    expect(rows.length).toBe(1);
    createdFunctions.push(...rows.map((r) => r.id));
  });

  it("publishes a procurement contract with value+currency and dedups", async () => {
    const ctx = makeCtx();
    const fact: ProcurementFact = {
      kind: "procurement",
      contractingAuthority: { type: EntityType.GOVERNMENT_BODY, name: "Testi Kaupunki", jurisdiction: "FI" },
      supplier: { type: EntityType.COMPANY, name: "Testi Rakennus Oy", jurisdiction: "FI" },
      value: 1200000,
      currency: "EUR",
      cpv: "45210000",
      procedure: "OPEN",
      noticeId: "TED-2026-000001",
      awardDate: new Date("2026-03-01"),
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/procurement",
    };
    expect((await publishProcurement(ctx, fact)).action).toBe("created");
    expect((await publishProcurement(ctx, fact)).action).toBe("unchanged");
    const authorityId = await trackEntityId({ type: EntityType.GOVERNMENT_BODY, name: "Testi Kaupunki" });
    const supplierId = await trackEntityId({ type: EntityType.COMPANY, name: "Testi Rakennus Oy" });
    const rows = await db!.procurementContract.findMany({ where: { contractingAuthorityEntityId: authorityId!, supplierEntityId: supplierId! } });
    expect(rows.length).toBe(1);
    expect(Number(rows[0].value)).toBe(1200000);
    createdProcurements.push(...rows.map((r) => r.id));
  });

  it("rejects a value without currency in a procurement", async () => {
    const ctx = makeCtx();
    const res = await publishProcurement(ctx, {
      kind: "procurement",
      contractingAuthority: { type: EntityType.GOVERNMENT_BODY, name: "Testi Kunta" },
      supplier: { type: EntityType.COMPANY, name: "Testi Firma Oy" },
      value: 1000,
      currency: undefined,
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/p",
    });
    expect(res.action).toBe("rejected");
  });

  it("publishes a lobbying engagement (never labelled as corruption)", async () => {
    const ctx = makeCtx();
    const fact: LobbyingFact = {
      kind: "lobbying",
      organization: { type: EntityType.ASSOCIATION, name: "Testi Etujärjestö ry", jurisdiction: "FI" },
      target: { type: EntityType.GOVERNMENT_BODY, name: "Testi Ministeriö", jurisdiction: "FI" },
      subject: "Sähkömarkkinalain valmistelu",
      communicationMethod: "kirjallinen kuuleminen",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-06-30"),
      ...OFFICIAL,
      evidenceUrl: "https://example.fi/lobbying",
    };
    expect((await publishLobbying(ctx, fact)).action).toBe("created");
    expect((await publishLobbying(ctx, fact)).action).toBe("unchanged");
    const orgId = await trackEntityId({ type: EntityType.ASSOCIATION, name: "Testi Etujärjestö ry" });
    const rows = await db!.lobbyingEngagement.findMany({ where: { organizationEntityId: orgId! } });
    expect(rows.length).toBe(1);
    createdLobbying.push(...rows.map((r) => r.id));
  });
});