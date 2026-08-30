import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ENTITY_URL_PREFIXES } from "@/lib/constants";
import { EntityType } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const prisma = hasDb ? new PrismaClient() : null;

describe("entity URL coverage invariant", () => {
  it("every entity type has a URL route prefix", () => {
    for (const v of Object.values(EntityType)) {
      expect(ENTITY_URL_PREFIXES[v], `missing prefix for ${v}`).toBeTruthy();
    }
  });
});

describe("database invariants (evidence-first, no fabricated data)", () => {
  it.skipIf(!hasDb)("every published relationship has at least one evidence record", async () => {
    const orphans = await prisma!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count
      FROM "Relationship" r
      WHERE r."verificationState" = 'PUBLISHED'
        AND NOT EXISTS (SELECT 1 FROM "Evidence" ev WHERE ev."relationshipId" = r.id)`;
    expect(Number(orphans[0].count)).toBe(0);
  });

  it.skipIf(!hasDb)("every financial flow has an amount and a currency", async () => {
    const bad = await prisma!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "FinancialFlow"
      WHERE amount IS NULL OR currency IS NULL OR currency = ''`;
    expect(Number(bad[0].count)).toBe(0);
  });

  it.skipIf(!hasDb)("no entity is duplicated by canonical name (excluding demo)", async () => {
    const realDups = await prisma!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM (
        SELECT "canonicalName" FROM "Entity"
        WHERE "canonicalName" NOT LIKE '%(demo)%'
        GROUP BY "canonicalName" HAVING count(*) > 1
      ) d`;
    expect(Number(realDups[0].count)).toBe(0);
  });

  it.skipIf(!hasDb)("every position references an existing person entity", async () => {
    const orphans = await prisma!.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Position" p
      WHERE NOT EXISTS (SELECT 1 FROM "Entity" e WHERE e.id = p."personEntityId")`;
    expect(Number(orphans[0].count)).toBe(0);
  });
});
