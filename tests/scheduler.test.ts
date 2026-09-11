import { describe, it, expect, beforeEach, afterAll } from "vitest";
import "dotenv/config";
import { dueSources, runOptionsFor, MAX_SOURCES_PER_TICK } from "@/lib/agents/scheduler";
import { db } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const IDS = ["sched-test-daily", "sched-test-weekly", "sched-test-manual", "sched-test-monthly"];

async function mkSource(id: string, cadence: string, lastCheckedAt: Date | null) {
  await db.ingestionSource.upsert({
    where: { id },
    update: { updateCadence: cadence, lastCheckedAt, enabled: true },
    create: {
      id,
      name: id,
      publisher: "test",
      baseUrl: "https://example.test/",
      sourceType: "OTHER",
      adapter: id,
      updateCadence: cadence,
      lastCheckedAt,
    },
  });
}

describe.skipIf(!hasDb)("source scheduler (Phase 14)", () => {
  beforeEach(async () => {
    await db.agentRun.deleteMany({ where: { agent: { in: IDS } } });
    await db.ingestionSource.deleteMany({ where: { id: { in: IDS } } });
    // Park the real sources so they don't crowd the per-tick cap in assertions.
    await db.ingestionSource.updateMany({
      where: { id: { notIn: IDS } },
      data: { lastCheckedAt: new Date() },
    });
  });
  afterAll(async () => {
    await db.agentRun.deleteMany({ where: { agent: { in: IDS } } });
    await db.ingestionSource.deleteMany({ where: { id: { in: IDS } } });
  });

  it("a never-checked daily source is due", async () => {
    await mkSource("sched-test-daily", "daily", null);
    expect(await dueSources()).toContain("sched-test-daily");
  });

  it("a daily source checked an hour ago is not due", async () => {
    await mkSource("sched-test-daily", "daily", new Date(Date.now() - 60 * 60 * 1000));
    expect(await dueSources()).not.toContain("sched-test-daily");
  });

  it("a weekly source checked 2 days ago is not due; 8 days ago is due", async () => {
    await mkSource("sched-test-weekly", "weekly", new Date(Date.now() - 2 * 864e5));
    expect(await dueSources()).not.toContain("sched-test-weekly");
    await mkSource("sched-test-weekly", "weekly", new Date(Date.now() - 8 * 864e5));
    expect(await dueSources()).toContain("sched-test-weekly");
  });

  it("a MANUAL source is never due on its own", async () => {
    await mkSource("sched-test-manual", "manual", null);
    expect(await dueSources()).not.toContain("sched-test-manual");
  });

  it("caps the number of sources per tick", async () => {
    await mkSource("sched-test-daily", "daily", null);
    await mkSource("sched-test-weekly", "weekly", null);
    await mkSource("sched-test-monthly", "monthly", null);
    const due = await dueSources();
    expect(due.length).toBeLessThanOrEqual(MAX_SOURCES_PER_TICK);
  });

  it("a RUNNING (paused) source is always included even if not cadence-due", async () => {
    await mkSource("sched-test-daily", "daily", new Date()); // just checked → not cadence-due
    await db.agentRun.create({ data: { agent: "sched-test-daily", status: "RUNNING" } });
    expect(await dueSources()).toContain("sched-test-daily");
  });

  it("a RUNNING source wins a scarce per-tick slot over stale-but-due sources ahead of it", async () => {
    // Two never-checked sources sort ahead of the RUNNING one (lastCheckedAt
    // asc, nulls first) and would otherwise fill both MAX_SOURCES_PER_TICK
    // slots every tick, starving the in-progress resumable run forever.
    await mkSource("sched-test-daily", "daily", null);
    await mkSource("sched-test-weekly", "weekly", null);
    await mkSource("sched-test-monthly", "monthly", new Date()); // fresh lastCheckedAt → not cadence-due
    await db.agentRun.create({ data: { agent: "sched-test-monthly", status: "RUNNING" } });
    const due = await dueSources();
    expect(due.length).toBeLessThanOrEqual(MAX_SOURCES_PER_TICK);
    expect(due).toContain("sched-test-monthly");
  });

  it("runOptionsFor returns bounded budgets", () => {
    expect(runOptionsFor("parliament-agent").maxDocsPerTick).toBeGreaterThan(0);
    expect(runOptionsFor("unknown").maxDocsPerTick).toBeLessThanOrEqual(5);
  });
});
