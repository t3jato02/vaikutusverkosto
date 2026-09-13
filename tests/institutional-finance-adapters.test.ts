import { describe, it, expect } from "vitest";
import { financeInstitutionsAdapter } from "@/lib/agents/financeInstitutions";
import { pensionGovernanceAdapter } from "@/lib/agents/pensionGovernance";
import { gleifResolutionAdapter } from "@/lib/agents/gleifResolution";
import { financeSections, pensionSections } from "@/lib/agents/data/finance";
import { GLEIF_INDEX } from "@/lib/agents/data/gleif/gleifIndex";
import type { RunContext, AgentFact, SourceAdapter } from "@/lib/agents/types";

function makeCtx(agentId: string): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: "agent-test", agentId, sourceId: "test", db: null as never, stats, log: () => {} };
}

async function collectFacts(adapter: SourceAdapter, ctx: RunContext): Promise<AgentFact[]> {
  const docs = await adapter.discover(ctx);
  const facts: AgentFact[] = [];
  for (const doc of docs) {
    const raw = await adapter.fetch(ctx, doc);
    facts.push(...(await adapter.parse(ctx, doc, raw)));
  }
  return facts;
}

describe("finance-institutions adapter contract", () => {
  const adapter = financeInstitutionsAdapter;

  it("exposes a bounded discover() — one document per manifest section", async () => {
    const ctx = makeCtx(adapter.id);
    const docs = await adapter.discover(ctx);
    expect(docs.length).toBe(financeSections.length);
    expect(docs.length).toBeGreaterThanOrEqual(5);
    for (const d of docs) expect(d.id.startsWith("finance:")).toBe(true);
  });

  it("parse() is deterministic — the same raw payload yields identical facts", async () => {
    const ctx = makeCtx(adapter.id);
    const docs = await adapter.discover(ctx);
    for (const doc of docs) {
      const raw = await adapter.fetch(ctx, doc);
      const a = await adapter.parse(ctx, doc, raw);
      const b = await adapter.parse(ctx, doc, raw);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("every parsed fact carries an evidence URL and structured kinds", async () => {
    const ctx = makeCtx(adapter.id);
    const facts = await collectFacts(adapter, ctx);
    expect(facts.length).toBeGreaterThan(200);
    const kinds = new Set(facts.map((f) => f.kind));
    expect(kinds.has("finance-institution")).toBe(true);
    expect(kinds.has("role")).toBe(true);
    expect(kinds.has("sector")).toBe(true);
    expect(kinds.has("external-identifier")).toBe(true);
    expect(kinds.has("scale-statement")).toBe(true);
    for (const f of facts) {
      if ("evidenceUrl" in f && typeof f.evidenceUrl === "string") {
        expect(f.evidenceUrl, `evidence missing on ${f.kind}`).toMatch(/^https?:\/\//);
      }
    }
  });

  it("produces stable dedupe keys (no duplicate facts across the manifest)", async () => {
    const ctx = makeCtx(adapter.id);
    const facts = await collectFacts(adapter, ctx);
    const keys = new Map<string, number>();
    for (const f of facts) {
      let key: string | null = null;
      if (f.kind === "finance-institution") key = `profile:${f.organization.name}:${f.institutionType}`;
      else if (f.kind === "role") key = `role:${f.person.name}:${f.organization?.name}:${f.role}`;
      else if (f.kind === "sector") key = `sector:${f.organization.name}:${f.sector}`;
      else if (f.kind === "scale-statement") key = `scale:${f.entity.name}:${f.metricType}:${f.year}`;
      else if (f.kind === "external-identifier") key = `extid:${f.entity.name}:${f.provider}:${f.identifier}`;
      else continue;
      keys.set(key, (keys.get(key) ?? 0) + 1);
    }
    for (const [k, n] of keys) {
      expect(n, `duplicate fact ${k}`).toBe(1);
    }
  });

  it("FIN-FSA is classified as the supervisor in the manifest", async () => {
    const finFsa = financeSections.flatMap((s) => s.orgs).find((o) => o.id === "finanssivalvonta");
    expect(finFsa).toBeDefined();
    expect(finFsa!.financeTypes).toContain("FINANCIAL_SUPERVISORY_AUTHORITY");
  });
});

describe("pension-governance adapter contract", () => {
  const adapter = pensionGovernanceAdapter;

  it("exposes a bounded discover() and deterministic parse()", async () => {
    const ctx = makeCtx(adapter.id);
    const docs = await adapter.discover(ctx);
    expect(docs.length).toBe(pensionSections.length);
    const facts = await collectFacts(adapter, ctx);
    expect(facts.length).toBeGreaterThan(50);
    const kinds = new Set(facts.map((f) => f.kind));
    expect(kinds.has("finance-institution")).toBe(true);
    expect(kinds.has("role")).toBe(true);
    expect(kinds.has("scale-statement")).toBe(true);
  });

  it("covers all four pension insurers + public pension institutions", async () => {
    const orgs = pensionSections.flatMap((s) => s.orgs);
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain("ilmarinen");
    expect(ids).toContain("varma");
    expect(ids).toContain("elo");
    expect(ids).toContain("veritas");
    expect(ids).toContain("keva");
    expect(ids).toContain("valtion-elakerahasto");
  });
});

describe("gleif-resolution adapter contract", () => {
  const adapter = gleifResolutionAdapter;

  it("exposes exactly one bounded document", async () => {
    const ctx = makeCtx(adapter.id);
    const docs = await adapter.discover(ctx);
    expect(docs.length).toBe(1);
  });

  it("emits LEI + BIC mappings and GLEIF-recorded parent relationships", async () => {
    const ctx = makeCtx(adapter.id);
    const docs = await adapter.discover(ctx);
    const raw = await adapter.fetch(ctx, docs[0]);
    const facts = await adapter.parse(ctx, docs[0], raw);
    const leiFacts = facts.filter((f) => f.kind === "external-identifier" && (f as { provider?: string }).provider === "gleif-lei");
    const bicFacts = facts.filter((f) => f.kind === "external-identifier" && (f as { provider?: string }).provider === "swift-bic");
    const parents = facts.filter((f) => f.kind === "relationship");
    expect(leiFacts.length).toBe(GLEIF_INDEX.length);
    expect(bicFacts.length).toBeGreaterThan(0);
    expect(parents.length).toBeGreaterThanOrEqual(2); // If→Holding, Nasdaq→Nasdaq Inc.
  });
});

describe("GLEIF index integrity", () => {
  it("all LEIs are unique and 20 characters", () => {
    const leis = GLEIF_INDEX.map((r) => r.lei);
    expect(new Set(leis).size).toBe(leis.length);
    for (const l of leis) expect(l, `bad LEI ${l}`).toMatch(/^[0-9A-Z]{20}$/);
  });

  it("every parentLei refers to a record in the index", () => {
    const leis = new Set(GLEIF_INDEX.map((r) => r.lei));
    for (const r of GLEIF_INDEX) {
      if (r.parentLei) expect(leis.has(r.parentLei), `missing parent ${r.parentLei} of ${r.lei}`).toBe(true);
    }
  });
});