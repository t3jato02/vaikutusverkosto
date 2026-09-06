import { describe, it, expect } from "vitest";
import "dotenv/config";
import { searchEntities } from "@/lib/queries";
import { db } from "@/lib/db";

describe("entity search ranking", () => {
  it("ranks a whole-word name match above an incidental mid-word substring", async () => {
    const orpo = await db.entity.findFirst({ where: { canonicalName: "Petteri Orpo" }, select: { id: true } });
    if (!orpo) return; // dataset without parliament data — nothing to assert
    const results = await searchEntities("Orpo", 8);
    const names = results.map((r) => r.canonicalName);
    const orpoIdx = names.indexOf("Petteri Orpo");
    expect(orpoIdx).toBeGreaterThanOrEqual(0);
    // "...Corporation" contains "orpo" mid-word; it must not outrank the real hit.
    const firstCorp = names.findIndex((n) => /corporation/i.test(n));
    if (firstCorp >= 0) expect(orpoIdx).toBeLessThan(firstCorp);
  });

  it("returns an exact match first", async () => {
    const any = await db.entity.findFirst({ select: { canonicalName: true }, orderBy: { sourceCount: "desc" } });
    if (!any) return;
    const results = await searchEntities(any.canonicalName, 5);
    expect(results[0]?.canonicalName.toLowerCase()).toBe(any.canonicalName.toLowerCase());
  });
});
