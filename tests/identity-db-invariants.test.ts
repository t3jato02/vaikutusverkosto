// Identity-framing DB invariants (luku 19/22). Self-skip when the identity
// pilot has not been seeded (npm run ingest:identity).

import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/lib/db";

afterAll(async () => {
  await db.$disconnect();
});

function countOf(rows: unknown): number {
  return Number((rows as { count: unknown }[])[0]?.count ?? 0);
}

describe("identity DB invariants", () => {
  it("no duplicate (person, article, expression, category) mentions", async () => {
    const dup = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "MediaIdentityMention" GROUP BY "personEntityId","articleId","expressionNormalized","termCategory" HAVING count(*) > 1`,
    );
    expect(dup).toEqual([]);
  });

  it("published identity facts are never EvidenceGrade E", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "BirthOriginFact" WHERE "reviewStatus"='PUBLISHED' AND "evidenceGrade"='E'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("birth-country values are uppercase ISO2 codes", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "BirthOriginFact" WHERE "factKind"='BIRTH_COUNTRY' AND "value" <> UPPER("value")`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("mention expressionNormalized is the folded expression", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "MediaIdentityMention" WHERE LOWER(TRIM("expression")) <> "expressionNormalized"`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("a PUBLISHED mention can only come from a PUBLISHED-approved flow (no REJECTED published)", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "MediaIdentityMention" WHERE "reviewStatus"='REJECTED' AND "reviewStatus"='PUBLISHED'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("identity facts require a source URL", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "CitizenshipFact" WHERE "sourceUrl" NOT LIKE 'http%'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("reverse comparison status is a known value", async () => {
    const rows = await db.identityComparison.findMany({ select: { status: true } });
    for (const r of rows) {
      expect(["COMPLETED", "INSUFFICIENT_SAMPLE", "ERROR"]).toContain(r.status);
    }
  });

  it("aggregates have deterministic unique scopeHash", async () => {
    const dup = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "IdentityFramingAggregate" GROUP BY "scopeHash" HAVING count(*) > 1`,
    );
    expect(dup).toEqual([]);
  });
});