import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "dotenv/config";
import { createHmac } from "node:crypto";
import { getPaymentProvider, __resetPaymentProvider, verifyStripeSignature } from "@/lib/vaikuta/payments";
import { getDeliveryProvider, __resetDeliveryProvider } from "@/lib/vaikuta/delivery";
import { paymentsEnabled, messageDeliveryEnabled, vaikutaFlags } from "@/lib/vaikuta/flags";

describe("VAIKUTA payment provider abstraction (section 8)", () => {
  beforeEach(() => {
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.PAYMENT_PROVIDER;
    __resetPaymentProvider();
  });
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.PAYMENT_PROVIDER;
    __resetPaymentProvider();
  });

  it("selects the mock provider by default and when disabled", () => {
    process.env.PAYMENTS_ENABLED = "false";
    __resetPaymentProvider();
    const p = getPaymentProvider();
    expect(p.isMock()).toBe(true);
    expect(p.name).toBe("mock");
  });

  it("never selects a real provider while PAYMENTS_ENABLED=false", () => {
    process.env.PAYMENTS_ENABLED = "false";
    process.env.PAYMENT_PROVIDER = "stripe";
    __resetPaymentProvider();
    const p = getPaymentProvider();
    expect(p.isMock()).toBe(true);
  });

  it("mock confirmCheckout produces no external charge id", async () => {
    const res = await getPaymentProvider().confirmCheckout({ sessionId: "s_1", amountMinor: 1490, currency: "EUR" });
    expect(res.paymentId).toBeNull();
  });

  it("mock provider reports no webhooks", async () => {
    const outcome = await getPaymentProvider().handleWebhook(new ArrayBuffer(0), null);
    expect(outcome.status).toBe("ignored");
  });

  it("verifies Stripe webhook signatures in constant-time style", () => {
    const secret = "whsec_test";
    const payload: Buffer = Buffer.from('{"id":"evt_1"}');
    const v1 = createHmac("sha256", secret).update(payload).digest("hex");
    const header = `t=123,v1=${v1}`;
    const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer;
    expect(verifyStripeSignature(ab, header, secret)).toBe(true);
    expect(verifyStripeSignature(ab, header, "whsec_wrong")).toBe(false);
    expect(verifyStripeSignature(ab, "t=1", secret)).toBe(false);
  });
});

describe("VAIKUTA features flags fail-safe (section 24)", () => {
  it("payments and real delivery default OFF; Vaikuta and AI default ON", () => {
    expect(paymentsEnabled()).toBe(false);
    expect(messageDeliveryEnabled()).toBe(false);
    const flags = vaikutaFlags();
    expect(flags.enabled).toBe(true);
    expect(flags.aiAssist).toBe(true);
    expect(flags.payments).toBe(false);
    expect(flags.delivery).toBe(false);
    expect(flags.paymentProvider).toBe("mock");
    expect(flags.deliveryProvider).toBe("mock");
  });
});

describe("VAIKUTA delivery provider abstraction (section 12)", () => {
  beforeEach(() => {
    delete process.env.MESSAGE_DELIVERY_ENABLED;
    delete process.env.MESSAGE_DELIVERY_PROVIDER;
    __resetDeliveryProvider();
  });
  afterEach(() => {
    delete process.env.MESSAGE_DELIVERY_ENABLED;
    delete process.env.MESSAGE_DELIVERY_PROVIDER;
    __resetDeliveryProvider();
  });

  it("mock provider simulates and never sends", async () => {
    const p = getDeliveryProvider();
    expect(p.isReal()).toBe(false);
    expect(p.canEngageRealDelivery()).toBe(false);
    const receipt = await p.submit({ campaignId: "c", recipientCount: 3 });
    expect(receipt.state).toBe("SIMULATED_DELIVERED");
    expect(receipt.simulated).toBe(true);
  });

  it("mock provider fails deterministically on zero recipients", async () => {
    const receipt = await getDeliveryProvider().submit({ campaignId: "c", recipientCount: 0 });
    expect(receipt.state).toBe("FAILED");
    expect(receipt.simulated).toBe(true);
  });

  it("no real provider is engaged while MESSAGE_DELIVERY_ENABLED=false", () => {
    process.env.MESSAGE_DELIVERY_ENABLED = "false";
    process.env.MESSAGE_DELIVERY_PROVIDER = "transactional";
    __resetDeliveryProvider();
    expect(getDeliveryProvider().isReal()).toBe(false);
    process.env.MESSAGE_DELIVERY_ENABLED = "false";
  });
});