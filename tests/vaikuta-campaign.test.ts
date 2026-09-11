import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// The lifecycle test legitimately creates many campaigns for one user within a
// minute; the hourly campaign rate limit is covered by its own unit logic and
// by the API-level rate limiter, so it is disabled for this integration run.
process.env.DISABLE_VAIKUTA_CAMPAIGN_RATE_LIMIT = "1";

import {
  createDraftCampaign,
  saveRecipients,
  saveMessage,
  approveMessage,
  startCheckout,
  confirmCheckout,
  simulateDelivery,
  getOwnedCampaign,
} from "@/lib/vaikuta/campaigns";
import { decideCheckout } from "@/lib/vaikuta/entitlements";
import { makeVaikutaFixture, destroyVaikutaFixture, type VaikutaFixture } from "./helpers/vaikuta-fixture";

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
let fx: VaikutaFixture;

const SUBJECT = "Näkemykseni digi-infrastruktuurin rahoituksesta";

// Each test needs its own unique body: the product intentionally blocks
// substantially identical messages toward the same decision (one-message-per-
// recipient protection), so cross-test reuse would trip duplicate detection.
const mkBody = (tag: string) =>
  `Haluan, että digitaalisen infrastruktuurin rahoituksesta keskustellaan avoimesti ja läpinäkyvästi yhdessä kansalaisten kanssa. ${tag} on oma näkemykseni aiheesta.`;

describe.skipIf(!db)("VAIKUTA campaign lifecycle (integration, section 23)", () => {
  beforeAll(async () => {
    fx = await makeVaikutaFixture(db!);
  });
  afterAll(async () => {
    if (fx) await destroyVaikutaFixture(db!, fx);
    await db!.$disconnect();
  });

  it("creates a draft campaign with a plan snapshot and pricing version", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja 1", planCode: "VAIKUTA_PASS" });
    expect(c.planCode).toBe("VAIKUTA_PASS");
    expect(c.planSnapshot).toBeTruthy();
    expect(c.pricingVersion).toMatch(/^v1-/);
  });

  it("cannot access a campaign created by another user", async () => {
    const c = await createDraftCampaign(fx.otherUserId, fx.decisionId, { title: "Kampanja owner", planCode: "VAIKUTA_PASS" });
    const owned = await getOwnedCampaign(fx.userId, c.id);
    expect(owned).toBeNull();
  });

  it("saves a subset of eligible recipients within the plan limit", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja recipients", planCode: "VAIKUTA_PASS" });
    await expect(
      saveRecipients({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [fx.personIds[0], fx.personIds[1], fx.personIds[2]], decisionId: fx.decisionId }),
    ).resolves.toBe(3);
  });

  it("REGRESSION: rejects recipients that are not source-backed (no auto-recommendation)", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja bad-recip", planCode: "VAIKUTA_PASS" });
    const bogus = crypto.randomUUID();
    await expect(
      saveRecipients({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [bogus], decisionId: fx.decisionId }),
    ).rejects.toMatchObject({ code: "recipient_not_eligible" });
  });

  it("REGRESSION: a user cannot bypass the recipient limit", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja limit", planCode: "FREE" });
    // FREE allows 10; submitting all 14 eligible members exceeds it.
    await expect(
      saveRecipients({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [...fx.personIds], decisionId: fx.decisionId }),
    ).rejects.toMatchObject({ code: "recipient_limit_exceeded" });
  });

  it("saves and validates the message; flags nothing for lawful opinion", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja message", planCode: "VAIKUTA_PASS" });
    const body = mkBody("message-testi");
    const r = await saveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status }, subject: SUBJECT, body, decisionId: fx.decisionId });
    expect(r.ok).toBe(true);
    expect(r.requiresModeration).toBe(false);
    const view = await getOwnedCampaign(fx.userId, c.id);
    expect(view!.messageBody).toBe(body);
  });

  it("REGRESSION: repeated identical campaign to the same decision is blocked", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja dup1", planCode: "VAIKUTA_PASS" });
    const body = mkBody("dupli");
    const first = await saveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status }, subject: SUBJECT, body, decisionId: fx.decisionId });
    expect(first.ok).toBe(true);
    const second = await saveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status }, subject: SUBJECT, body, decisionId: fx.decisionId });
    expect(second.ok).toBe(false);
    expect(second.errors).toContain("duplicate_campaign");
  });

  it("appends audit events through the lifecycle", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja audit", planCode: "VAIKUTA_PASS" });
    await saveRecipients({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [fx.personIds[0]], decisionId: fx.decisionId });
    const body = mkBody("audit");
    await saveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status }, subject: SUBJECT, body, decisionId: fx.decisionId });
    await approveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status, messageBody: body } });
    const view = await getOwnedCampaign(fx.userId, c.id);
    const types = view!.events.map((e) => e.type);
    expect(types).toContain("created");
    expect(types).toContain("recipient_added");
    expect(types).toContain("message_updated");
    expect(types).toContain("message_approved");
  });

  it("REGRESSION: checkout is priced server-side at €14.90 (1490), never from a client value", async () => {
    const decision = await decideCheckout(fx.userId, "VAIKUTA_PASS");
    expect(decision.chargeMinor).toBe(1490);
    expect(decision.coveredBySubscription).toBe(false);
  });

  it("REGRESSION: a user cannot re-price a campaign to €0 (FREE)", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja zero", planCode: "VAIKUTA_PASS" });
    // Attacker flips the plan to FREE via the (validated) plan route.
    await db!.influenceCampaign.update({ where: { id: c.id }, data: { planCode: "FREE" } });
    await expect(decideCheckout(fx.userId, "FREE")).rejects.toMatchObject({ status: 403 });
  });

  it("completes the full mock flow: checkout → confirm (€14.90) → delivery (simulated)", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja full", planCode: "VAIKUTA_PASS" });
    await saveRecipients({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [fx.personIds[0], fx.personIds[1]], decisionId: fx.decisionId });
    const body = mkBody("koko-virta");
    await saveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status }, subject: SUBJECT, body, decisionId: fx.decisionId });
    await approveMessage({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, status: c.status, messageBody: body } });

    const started = await startCheckout({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode, status: "APPROVED" }, baseUrl: "http://localhost:3000" });
    expect(started.amountMinor).toBe(1490);
    expect(started.isMock).toBe(true);
    expect(started.redirectUrl).toBeNull();

    const confirmed = await confirmCheckout({ userId: fx.userId, sessionId: started.sessionId });
    expect(confirmed.amountMinor).toBe(1490);
    expect(confirmed.isMock).toBe(true);

    const viewAfterPay = await getOwnedCampaign(fx.userId, c.id);
    expect(viewAfterPay!.paymentStatus).toBe("SUCCEEDED");
    expect(viewAfterPay!.status).toBe("PAYMENT_COMPLETED");
    const planSnapshot = viewAfterPay!.planSnapshot as { chargedMinor?: number } | null;
    expect(planSnapshot?.chargedMinor).toBe(1490);

    const receipt = await simulateDelivery({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, paymentStatus: viewAfterPay!.paymentStatus, status: viewAfterPay!.status } });
    expect(receipt.simulated).toBe(true);
    expect(receipt.state).toBe("SIMULATED_DELIVERED");

    const finalView = await getOwnedCampaign(fx.userId, c.id);
    expect(finalView!.status).toBe("DELIVERED");
    expect(finalView!.deliveryStatus).toBe("SIMULATED_DELIVERED");
    expect(finalView!.recipients.every((r) => r.deliveryStatus === "SIMULATED_DELIVERED")).toBe(true);
  });

  it("REGRESSION: delivery is impossible without a succeeded payment", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja nodeliver", planCode: "VAIKUTA_PASS" });
    await expect(
      simulateDelivery({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, paymentStatus: null, status: "APPROVED" } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("REGRESSION: authorization — a second user cannot touch the campaign", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja auth", planCode: "VAIKUTA_PASS" });
    await expect(
      saveRecipients({ userId: fx.otherUserId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode }, entityIds: [fx.personIds[0]], decisionId: fx.decisionId }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("REGRESSION: prototype cannot execute a real charge nor real external delivery", async () => {
    const c = await createDraftCampaign(fx.userId, fx.decisionId, { title: "Kampanja norealdelivery", planCode: "VAIKUTA_PASS" });
    const started = await startCheckout({ userId: fx.userId, campaign: { id: c.id, userId: c.userId, planCode: c.planCode, status: "APPROVED" }, baseUrl: "http://localhost:3000" });
    await confirmCheckout({ userId: fx.userId, sessionId: started.sessionId });
    const payment = await db!.vaikutaPayment.findFirst({ where: { checkoutSessionId: started.sessionId } });
    expect(payment!.isMock).toBe(true);
    expect(payment!.provider).toBe("mock");
    // No external refs exist for a mock payment.
    expect(payment!.providerPaymentId).toBeNull();
    expect(payment!.providerChargeId).toBeNull();
  });
});