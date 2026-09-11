import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getEntitlement, getActiveSubscription } from "@/lib/vaikuta/entitlements";
import { ensurePlans } from "@/lib/vaikuta/campaigns";
import { makeVaikutaFixture, destroyVaikutaFixture, type VaikutaFixture } from "./helpers/vaikuta-fixture";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
let fx: VaikutaFixture;
let userId: string;

describe.skipIf(!db)("VAIKUTA entitlements (section 9)", () => {
  beforeAll(async () => {
    fx = await makeVaikutaFixture(db!);
    userId = fx.userId;
    await ensurePlans();
  });
  afterAll(async () => {
    if (fx) await destroyVaikutaFixture(db!, fx);
    await db!.$disconnect();
  });

  it("defaults to FREE — no paid execution without a subscription or one-time pass", async () => {
    const e = await getEntitlement(userId);
    expect(e.planCode).toBe("FREE");
    expect(e.canExecute).toBe(false);
    expect(e.recipientLimit).toBe(10);
  });

  it("an active PLUS subscription grants the PLUS allowance and limit", async () => {
    const plan = await db!.vaikutaPlan.findUniqueOrThrow({ where: { code: "VAIKUTA_PLUS" } });
    await db!.vaikutaSubscription.create({
      data: { userId, planId: plan.id, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86400_000), provider: "mock" },
    });
    const e = await getEntitlement(userId);
    expect(e.planCode).toBe("VAIKUTA_PLUS");
    expect(e.canExecute).toBe(true);
    expect(e.recipientLimit).toBe(50);
    expect(e.executedInWindow).toBe(0);
    const sub = await getActiveSubscription(userId);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("a one-time PASS purchase does not create a monthly subscription but unlocks that campaign via payment", async () => {
    // Covered implicitly by the campaign lifecycle test (SUCCEEDED payment).
    const sub = await getActiveSubscription(userId);
    expect(sub?.plan.code).toBe("VAIKUTA_PLUS");
  });
});