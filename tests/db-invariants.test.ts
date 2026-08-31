import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;

describe("DB invariants after agent runs (P8/P34)", () => {
  it.skipIf(!db)("every published relationship has evidence", async () => {
    const orphans = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Relationship" r
      WHERE r."verificationState" = 'PUBLISHED'
        AND NOT EXISTS (SELECT 1 FROM "Evidence" ev WHERE ev."relationshipId" = r.id)`;
    expect(Number(orphans[0].count)).toBe(0);
  });

  it.skipIf(!db)("every published financial flow has evidence, amount and currency", async () => {
    const bad = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "FinancialFlow" f
      WHERE f.amount IS NULL OR f.currency IS NULL OR f.currency = ''
         OR NOT EXISTS (SELECT 1 FROM "Evidence" ev WHERE ev."flowId" = f.id)`;
    expect(Number(bad[0].count)).toBe(0);
  });

  it.skipIf(!db)("procurement flows never target confidential vendors", async () => {
    const conf = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "FinancialFlow" f
      JOIN "Entity" e ON e.id = f."recipientEntityId"
      WHERE e."canonicalName" ILIKE '%salassa%' OR e."canonicalName" ILIKE '%confidential%'`;
    expect(Number(conf[0].count)).toBe(0);
  });

  it.skipIf(!db)("no duplicate canonical names among persons (excluding test fixtures)", async () => {
    const dups = await db!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM (
        SELECT "canonicalName" FROM "Entity"
        WHERE type = 'PERSON' AND "canonicalName" NOT LIKE 'Testi %'
        GROUP BY "canonicalName" HAVING count(*) > 1
      ) d`;
    expect(Number(dups[0].count)).toBe(0);
  });
});