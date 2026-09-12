import { describe, it, expect } from "vitest";
import { publicInstitutionsAdapter } from "@/lib/agents/publicInstitutions";
import { publicInstitutionSections } from "@/lib/agents/data/institutions";
import type { RunContext, AgentFact } from "@/lib/agents/types";

function makeCtx(): RunContext {
  const stats = { scanned: 0, proposed: 0, created: 0, updated: 0, rejected: 0, errors: 0, candidates: 0 };
  return { runId: "agent-test", agentId: publicInstitutionsAdapter.id, sourceId: "test", db: null as never, stats, log: () => {} };
}

describe("public-institutions adapter contract (stream C)", () => {
  it("exposes a bounded discover() — one document per manifest section", async () => {
    const docs = await publicInstitutionsAdapter.discover(makeCtx());
    expect(docs.length).toBe(publicInstitutionSections.length);
    expect(docs.length).toBeGreaterThanOrEqual(3);
    for (const d of docs) expect(d.id.startsWith("public-institutions:")).toBe(true);
  });

  it("parse() is deterministic — the same raw payload yields identical facts", async () => {
    const docs = await publicInstitutionsAdapter.discover(makeCtx());
    for (const doc of docs) {
      const raw = await publicInstitutionsAdapter.fetch(makeCtx(), doc);
      const a = await publicInstitutionsAdapter.parse(makeCtx(), doc, raw);
      const b = await publicInstitutionsAdapter.parse(makeCtx(), doc, raw);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("every parsed fact carries an evidence URL and resolves to structured fact kinds", async () => {
    const docs = await publicInstitutionsAdapter.discover(makeCtx());
    const facts: AgentFact[] = [];
    for (const doc of docs) {
      const raw = await publicInstitutionsAdapter.fetch(makeCtx(), doc);
      facts.push(...(await publicInstitutionsAdapter.parse(makeCtx(), doc, raw)));
    }
    expect(facts.length).toBeGreaterThan(200);
    const kinds = new Set(facts.map((f) => f.kind));
    expect(kinds.has("institutional-category")).toBe(true);
    expect(kinds.has("role")).toBe(true);
    expect(kinds.has("relationship")).toBe(true);
    for (const f of facts) {
      if ("evidenceUrl" in f && typeof f.evidenceUrl === "string") {
        expect(f.evidenceUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("does not duplicate facts across a rerun of the same manifest (stable dedupe keys)", async () => {
    const docs = await publicInstitutionsAdapter.discover(makeCtx());
    const keys = new Map<string, number>();
    for (const doc of docs) {
      const raw = await publicInstitutionsAdapter.fetch(makeCtx(), doc);
      const facts = await publicInstitutionsAdapter.parse(makeCtx(), doc, raw);
      for (const f of facts) {
        let key: string;
        if (f.kind === "institutional-category") key = `cat:${f.organization.name}:${f.category}`;
        else if (f.kind === "role") key = `role:${f.person.name}:${f.organization?.name}:${f.role}`;
        else if (f.kind === "relationship") key = `rel:${f.source.name}:${f.target.name}:${f.relationshipType}`;
        else continue;
        keys.set(key, (keys.get(key) ?? 0) + 1);
      }
    }
    for (const [k, n] of keys) {
      expect(n, `duplicate fact ${k}`).toBe(1);
    }
  });
});