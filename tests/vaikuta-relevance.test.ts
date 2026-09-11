import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getDecisionRecipients, getDecisionMedia, groupRecipients } from "@/lib/vaikuta/relevance";
import { makeVaikutaFixture, destroyVaikutaFixture, type VaikutaFixture } from "./helpers/vaikuta-fixture";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
let fx: VaikutaFixture;

describe.skipIf(!db)("VAIKUTA recipient relevance engine (section 3)", () => {
  beforeAll(async () => {
    fx = await makeVaikutaFixture(db!);
  });
  afterAll(async () => {
    if (fx) await destroyVaikutaFixture(db!, fx);
    await db!.$disconnect();
  });

  it("returns committee members and voters, all source-backed", async () => {
    const recipients = await getDecisionRecipients(fx.decisionId);
    expect(recipients.length).toBeGreaterThanOrEqual(14);
    for (const r of recipients) {
      // No recipient without source evidence (invariant §2 / §27).
      expect(r.sourceId).toBeTruthy();
      expect(r.sourceUrl).not.toBe("#");
      expect(r.sourceName.length).toBeGreaterThan(0);
      expect(r.reasonText.length).toBeGreaterThan(10);
    }
    const ids = new Set(recipients.map((r) => r.entityId));
    expect(ids.has(fx.personIds[0])).toBe(true); // chairman + voter
    expect(ids.has(fx.personIds[1])).toBe(true);
  });

  it("media coverage is computed separately and never mixed into decision makers", async () => {
    const makers = await getDecisionRecipients(fx.decisionId);
    const media = await getDecisionMedia(fx.decisionId);
    const makerIds = new Set(makers.map((m) => m.entityId));
    expect(media.some((m) => m.entityId === fx.journalistId)).toBe(true);
    expect(makers.every((m) => m.isMedia === false)).toBe(true);
    // Regression (section 23): a journalist cannot appear as a decision maker
    // solely because they wrote an article.
    expect(makerIds.has(fx.journalistId)).toBe(false);
  });

  it("every candidate has a 'why relevant' reason and a source link", async () => {
    const [makers, media] = await Promise.all([getDecisionRecipients(fx.decisionId), getDecisionMedia(fx.decisionId)]);
    for (const c of [...makers, ...media]) {
      expect(c.reasonText.length).toBeGreaterThan(10);
      expect(c.sourceName.length).toBeGreaterThan(0);
      expect(c.sourceUrl.startsWith("http")).toBe(true);
    }
  });

  it("groups recipients into the four categories with counts", async () => {
    const [makers, media] = await Promise.all([getDecisionRecipients(fx.decisionId), getDecisionMedia(fx.decisionId)]);
    const groups = groupRecipients([...makers, ...media]);
    const byKey = new Map(groups.map((g) => [g.key, g.count]));
    expect(byKey.get("decision_makers")!).toBeGreaterThan(0);
    expect(byKey.get("committee_and_preparation")!).toBeGreaterThan(0);
    expect(byKey.get("media")!).toBeGreaterThan(0);
    expect(groups.find((g) => g.key === "media")!.isMedia).toBe(true);
  });
});

describe("VAIKUTA auth hashing (section 6)", () => {
  it("hashPassword/verifyPassword round-trips and rejects wrong values", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/vaikuta/authUser");
    const hash = await hashPassword("salasana-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("salasana-123", hash)).toBe(true);
    expect(await verifyPassword("väärä-123", hash)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});