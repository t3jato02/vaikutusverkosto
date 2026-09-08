import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import "@/lib/agents/registry";
import {
  syncRegistry,
  listRegistry,
  recordRegistryCheck,
  isSourceEnabled,
  ensureRegistrySource,
  sourceAlert,
  nextDueAt,
} from "@/lib/agents/sourceRegistry";
import { listAdapters } from "@/lib/agents/registry";
import { db } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Source Registry (Sprint B)", () => {
  beforeAll(async () => {
    await syncRegistry();
  });

  it("has one row per registered adapter", async () => {
    const rows = await listRegistry();
    const ids = new Set(rows.map((r) => r.id));
    for (const a of listAdapters()) expect(ids.has(a.id)).toBe(true);
  });

  it("is idempotent — a second sync creates no duplicates", async () => {
    const before = (await listRegistry()).length;
    await syncRegistry();
    await syncRegistry();
    const after = (await listRegistry()).length;
    expect(after).toBe(before);
  });

  it("preserves the operator `enabled` flag across a sync", async () => {
    const [first] = await listRegistry();
    await db.ingestionSource.update({ where: { id: first.id }, data: { enabled: false } });
    await syncRegistry();
    const reread = await db.ingestionSource.findUnique({ where: { id: first.id } });
    expect(reread?.enabled).toBe(false);
    // restore
    await db.ingestionSource.update({ where: { id: first.id }, data: { enabled: true } });
  });

  it("records a successful check: lastSuccessAt set, failures cleared", async () => {
    const id = listAdapters()[0].id;
    await db.ingestionSource.update({ where: { id }, data: { consecutiveFailures: 5, lastError: "boom" } });
    await recordRegistryCheck(id, { ok: true });
    const row = await db.ingestionSource.findUnique({ where: { id } });
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.lastError).toBeNull();
    expect(row?.lastSuccessAt).toBeInstanceOf(Date);
  });

  it("records a failed check: increments failures, stores the error", async () => {
    const id = listAdapters()[0].id;
    await db.ingestionSource.update({ where: { id }, data: { consecutiveFailures: 0, lastError: null } });
    await recordRegistryCheck(id, { ok: false, error: "network unreachable" });
    await recordRegistryCheck(id, { ok: false, error: "network unreachable" });
    const row = await db.ingestionSource.findUnique({ where: { id } });
    expect(row?.consecutiveFailures).toBe(2);
    expect(row?.lastError).toContain("network unreachable");
    // reset to healthy for other tests / suites
    await recordRegistryCheck(id, { ok: true });
  });

  it("isSourceEnabled reflects the flag; unknown ids default to enabled", async () => {
    const id = listAdapters()[0].id;
    await db.ingestionSource.update({ where: { id }, data: { enabled: false } });
    expect(await isSourceEnabled(id)).toBe(false);
    await db.ingestionSource.update({ where: { id }, data: { enabled: true } });
    expect(await isSourceEnabled(id)).toBe(true);
    expect(await isSourceEnabled("does-not-exist-agent")).toBe(true);
  });

  it("ensureRegistrySource returns null for an unknown adapter", async () => {
    expect(await ensureRegistrySource("no-such-adapter")).toBeNull();
  });
});

describe("ingestion alerts (Sprint C5, Phase 28)", () => {
  // Fixture is relative to "now" so the overdue check (`Date.now() - due > daily`)
  // is stable regardless of when the suite runs (the old hardcoded 2026-09-06
  // fixture started failing once the system clock advanced past it).
  const base = {
    enabled: true,
    consecutiveFailures: 0,
    lastSuccessAt: new Date(),
    lastCheckedAt: new Date(),
    lastError: null as string | null,
    lastRunDocsChecked: 120,
    updateCadence: "daily",
  };

  it("a healthy, producing source is OK", () => {
    expect(sourceAlert(base).level).toBe("OK");
  });

  it("a previously-healthy source that finds zero documents is a WARNING", () => {
    const a = sourceAlert({ ...base, lastRunDocsChecked: 0 });
    expect(a.level).toBe("WARNING");
    expect(a.reasons.join(" ")).toMatch(/ei löytänyt yhtään dokumenttia/);
  });

  it("schema drift in lastError escalates to FAILING", () => {
    const a = sourceAlert({ ...base, lastError: "EU FTS 2024: source schema drift — required field(s) missing: Year" });
    expect(a.level).toBe("FAILING");
  });

  it("three consecutive failures is FAILING; one is DEGRADED", () => {
    expect(sourceAlert({ ...base, consecutiveFailures: 3 }).level).toBe("FAILING");
    expect(sourceAlert({ ...base, consecutiveFailures: 1 }).level).toBe("DEGRADED");
  });

  it("a disabled source raises no alert", () => {
    expect(sourceAlert({ ...base, enabled: false, consecutiveFailures: 9 }).level).toBe("OK");
  });

  it("nextDueAt advances by the cadence step", () => {
    const due = nextDueAt({ lastCheckedAt: new Date("2026-09-06T04:00:00Z"), updateCadence: "weekly" });
    expect(due?.toISOString().slice(0, 10)).toBe("2026-09-13");
  });
});
