import { describe, it, expect } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createSessionToken, verifySessionToken, safeEqual } from "@/lib/auth";

describe("admin session auth (P2)", () => {
  it("creates and verifies a session token", async () => {
    const token = await createSessionToken();
    const payload = await verifySessionToken(token);
    expect(payload?.role).toBe("admin");
  });

  it("rejects garbage tokens", async () => {
    expect(await verifySessionToken("garbage")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("rejects tokens signed with the wrong secret", async () => {
    const prev = process.env.AUTH_SECRET;
    const token = await createSessionToken();
    process.env.AUTH_SECRET = "another-secret-of-sufficient-length";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = prev;
  });
});

describe("timing-safe comparison", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });
  it("compares unequal strings", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("demo data production guard (P4)", () => {
  it.skipIf(!process.env.DATABASE_URL)("production dataset contains zero DEMO money flows", async () => {
    const db = new PrismaClient();
    const demo = await db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "FinancialFlow"
      WHERE purpose LIKE '%(demo)%' OR "description" LIKE '%DEMO%'`;
    expect(Number(demo[0].count)).toBe(0);
    await db.$disconnect();
  });
});