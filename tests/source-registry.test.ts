import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import "@/lib/agents/registry";
import {
  syncRegistry,
  listRegistry,
  recordRegistryCheck,
  isSourceEnabled,
  ensureRegistrySource,
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
