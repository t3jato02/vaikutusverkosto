// VAIKUTA payment provider abstraction (section 8).
//
// The running prototype always uses the MockPaymentProvider and PAYMENTS_ENABLED
// defaults to false — the prototype NEVER charges anything. A Stripe adapter is
// implemented against the Stripe REST API but is only ever engaged when
// PAYMENTS_ENABLED=true AND PAYMENT_PROVIDER=stripe AND secret keys are set.
// Secrets never reach the client.

import { createHmac, timingSafeEqual } from "node:crypto";
import { paymentsEnabled, paymentProviderName } from "@/lib/vaikuta/flags";

export interface CheckoutRequest {
  userId: string;
  campaignId?: string | null;
  planCode: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  sessionId: string;
  /** External redirect URL when a real provider is live; null for mock. */
  redirectUrl: string | null;
  provider: string;
  isMock: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  isMock(): boolean;
  /** Create a checkout session for the given charge. */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResponse>;
  /** Mark a mock checkout as paid (idempotent). */
  confirmCheckout(input: { sessionId: string; amountMinor: number; currency: string }): Promise<{ paymentId: string | null }>;
  /** Reserved for subscription billing. */
  cancelSubscription(opts: { providerSubscriptionId: string }): Promise<void>;
  /** Idempotent webhook handler. */
  handleWebhook(body: ArrayBuffer, signature: string | null): Promise<WebhookOutcome>;
  refundPayment(opts: { providerChargeId: string }): Promise<void>;
}

export type WebhookOutcome =
  | { status: "ignored"; reason: string }
  | { status: "processed"; eventId: string; sessionId: string }
  | { status: "rejected"; reason: string };

// ---------------------------------------------------------------- mock provider

class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  isMock(): boolean {
    return true;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    // The mock provider performs no external call. `sessionId` is the
    // VaikutaCheckoutSession id created by the orchestrator.
    return {
      sessionId: req.campaignId ?? "",
      redirectUrl: null,
      provider: "mock",
      isMock: true,
    };
  }

  async confirmCheckout(input: { sessionId: string; amountMinor: number; currency: string }): Promise<{ paymentId: string | null }> {
    void input;
    return { paymentId: null };
  }

  async cancelSubscription(): Promise<void> {
    // nothing to cancel without a backing provider
  }

  async handleWebhook(): Promise<WebhookOutcome> {
    return { status: "ignored", reason: "mock provider has no webhooks" };
  }

  async refundPayment(): Promise<void> {
    // nothing to refund without a backing provider
  }
}

// ---------------------------------------------------------------- stripe adapter (architecture)

const STRIPE_API = "https://api.stripe.com/v1";

function stripKey(): string {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  isMock(): boolean {
    return false;
  }

  private assertLiveEnabled() {
    if (!paymentsEnabled()) {
      throw new Error("StripePaymentProvider used while PAYMENTS_ENABLED=false — refusing.");
    }
    if (!stripKey()) {
      throw new Error("STRIPE_SECRET_KEY is not configured — refusing live checkout.");
    }
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    this.assertLiveEnabled();
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", req.successUrl);
    form.set("cancel_url", req.cancelUrl);
    form.set("line_items[0][price_data][currency]", req.currency.toLowerCase());
    form.set("line_items[0][price_data][unit_amount]", String(req.amountMinor));
    form.set("line_items[0][price_data][product_data][name]", `VAIKUTA ${req.planCode} — kampanja`);
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[userId]", req.userId);
    form.set("metadata[campaignId]", req.campaignId ?? "");
    form.set("metadata[planCode]", req.planCode);

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripKey()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status}`);
    const json = (await res.json()) as { id: string; url: string };
    return { sessionId: json.id, redirectUrl: json.url, provider: "stripe", isMock: false };
  }

  async confirmCheckout(): Promise<{ paymentId: string | null }> {
    throw new Error("confirmCheckout is a mock-only operation; use Stripe webhooks.");
  }

  async cancelSubscription(opts: { providerSubscriptionId: string }): Promise<void> {
    this.assertLiveEnabled();
    await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(opts.providerSubscriptionId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripKey()}` },
    });
  }

  async handleWebhook(body: ArrayBuffer, signature: string | null): Promise<WebhookOutcome> {
    if (!paymentsEnabled()) return { status: "ignored", reason: "PAYMENTS_ENABLED=false" };
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) return { status: "rejected", reason: "missing webhook signature or secret" };
    if (!verifyStripeSignature(body, signature, secret)) {
      return { status: "rejected", reason: "invalid webhook signature" };
    }
    const raw = Buffer.from(body).toString("utf8");
    const event = JSON.parse(raw) as {
      id: string;
      type: string;
      data: { object: { id: string; metadata?: Record<string, string> } };
    };
    if (event.type !== "checkout.session.completed") {
      return { status: "ignored", reason: `unhandled event ${event.type}` };
    }
    return { status: "processed", eventId: event.id, sessionId: event.data.object.id };
  }

  async refundPayment(opts: { providerChargeId: string }): Promise<void> {
    this.assertLiveEnabled();
    const form = new URLSearchParams();
    form.set("charge", opts.providerChargeId);
    await fetch(`${STRIPE_API}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stripKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  }
}

// Stripe's Webhook-Signature header: `t=timestamp,v1=hexhmac`. Verification is
// constant-time over the raw body using HMAC-SHA256 (architecture for later).
export function verifyStripeSignature(rawBody: ArrayBuffer, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k) acc[k] = v ?? "";
    return acc;
  }, {});
  const signature = parts["v1"];
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(Buffer.from(rawBody)).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let providerSingleton: PaymentProvider | null = null;

/** Select a provider. Mock unless payments are explicitly enabled. */
export function getPaymentProvider(): PaymentProvider {
  if (providerSingleton) return providerSingleton;
  const name = paymentProviderName();
  providerSingleton =
    name === "stripe" && paymentsEnabled() ? new StripePaymentProvider() : new MockPaymentProvider();
  return providerSingleton;
}

/** Clear cached provider (tests / env changes). */
export function __resetPaymentProvider(): void {
  providerSingleton = null;
}