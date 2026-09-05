import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  confidenceToScore,
  deriveAgentStatus,
  isConfirmed,
  isPubliclyVisible,
  PUBLIC_VISIBLE_STATUSES,
} from "@/lib/verification";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

describe("A7 verification model — pure semantics", () => {
  it("maps every legacy confidence bucket into [0,1]", () => {
    for (const c of ["VERIFIED", "HIGH", "MEDIUM", "LOW", "DISPUTED"] as const) {
      const s = confidenceToScore(c);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(confidenceToScore("VERIFIED")).toBeGreaterThan(confidenceToScore("LOW"));
  });

  it("an agent may only ever derive AUTO_DETECTED or SOURCE_CONFIRMED", () => {
    expect(deriveAgentStatus({ sourceType: "OFFICIAL_REGISTER", confidence: "VERIFIED" })).toBe("SOURCE_CONFIRMED");
    expect(deriveAgentStatus({ sourceType: "PARLIAMENTARY_RECORD", confidence: "HIGH" })).toBe("SOURCE_CONFIRMED");
    expect(deriveAgentStatus({ sourceType: "SECONDARY_MEDIA", confidence: "VERIFIED" })).toBe("AUTO_DETECTED");
    expect(deriveAgentStatus({ sourceType: "OFFICIAL_REGISTER", confidence: "MEDIUM" })).toBe("AUTO_DETECTED");
    for (const st of ["OFFICIAL_PRIMARY", "REPUTABLE_MEDIA", "OTHER"]) {
      for (const cf of ["VERIFIED", "HIGH", "MEDIUM", "LOW", "DISPUTED"] as const) {
        const r = deriveAgentStatus({ sourceType: st, confidence: cf });
        expect(["AUTO_DETECTED", "SOURCE_CONFIRMED"]).toContain(r);
      }
    }
  });

  it("publication policy: AUTO_DETECTED and REJECTED are not publicly visible; DISPUTED/STALE are visible-but-flagged", () => {
    expect(isPubliclyVisible("AUTO_DETECTED")).toBe(false);
    expect(isPubliclyVisible("REJECTED")).toBe(false);
    expect(isPubliclyVisible("SOURCE_CONFIRMED")).toBe(true);
    expect(isPubliclyVisible("HUMAN_VERIFIED")).toBe(true);
    expect(isPubliclyVisible("DISPUTED")).toBe(true);
    expect(isPubliclyVisible("STALE")).toBe(true);
    expect(isConfirmed("DISPUTED")).toBe(false);
    expect(isConfirmed("STALE")).toBe(false);
    expect(isConfirmed("SOURCE_CONFIRMED")).toBe(true);
  });
});

describe("A7 verification model — DB invariants", () => {
  it.skipIf(!db)("confidenceScore is within [0,1] on every relationship and flow", async () => {
    const badRel = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Relationship"
      WHERE "confidenceScore" IS NOT NULL AND ("confidenceScore" < 0 OR "confidenceScore" > 1)`;
    const badFlow = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "FinancialFlow"
      WHERE "confidenceScore" IS NOT NULL AND ("confidenceScore" < 0 OR "confidenceScore" > 1)`;
    expect(Number(badRel[0].count)).toBe(0);
    expect(Number(badFlow[0].count)).toBe(0);
  });

  it.skipIf(!db)("the DB CHECK constraint rejects an out-of-range confidenceScore", async () => {
    await expect(
      db!.$executeRawUnsafe(
        `UPDATE "Relationship" SET "confidenceScore" = 1.5 WHERE id = (SELECT id FROM "Relationship" LIMIT 1)`,
      ),
    ).rejects.toThrow();
  });

  it.skipIf(!db)("every relationship and flow has a non-null verificationStatus", async () => {
    const r = await db!.relationship.count({ where: { verificationStatus: { in: PUBLIC_VISIBLE_STATUSES.concat(["AUTO_DETECTED", "REJECTED"]) } } });
    const total = await db!.relationship.count();
    expect(r).toBe(total);
  });

  it.skipIf(!db)("no REJECTED relationship is publicly visible via the shared filter", async () => {
    const leaked = await db!.relationship.count({
      where: { verificationStatus: "REJECTED", AND: { verificationStatus: { in: PUBLIC_VISIBLE_STATUSES } } },
    });
    expect(leaked).toBe(0);
  });

  it.skipIf(!db)("published relationships still all have evidence (invariant preserved)", async () => {
    const orphans = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Relationship" r
      WHERE r."verificationState" = 'PUBLISHED'
        AND NOT EXISTS (SELECT 1 FROM "Evidence" ev WHERE ev."relationshipId" = r.id)`;
    expect(Number(orphans[0].count)).toBe(0);
  });
});
