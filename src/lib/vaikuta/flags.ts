// VAIKUTA feature flags — single source of truth for module gates.
//
// Fail-safe rule (section 24): if configuration is ambiguous, real payments
// and external message delivery are OFF. Everything below that touches real
// money or real outbound communication is independently gated by its own set
// of env vars AND a default-off value derived here.

function env(name: string, fallback: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return fallback;
  return v.trim();
}

/**
 * Master switch for the whole VAIKUTA product surface. Defaults ON — the
 * module is part of the running product and the demo fixture is clearly
 * marked. Set VAIKUTA_ENABLED=false to hide it entirely.
 */
export function vaikutaEnabled(): boolean {
  return env("VAIKUTA_ENABLED", "true").toLowerCase() !== "false";
}

/** Whether public (non-private) campaigns may be published. Default OFF. */
export function publicCampaignsEnabled(): boolean {
  return env("VAIKUTA_PUBLIC_CAMPAIGNS", "false").toLowerCase() === "true";
}

/** Whether the deterministic message-assistance tools are available. Default ON. */
export function aiAssistEnabled(): boolean {
  return env("VAIKUTA_AI_ASSIST", "true").toLowerCase() !== "false";
}

/**
 * Whether a *real* payment provider may be engaged. Default OFF, fail-safe.
 * Real charges are only possible when this is exactly "true" AND the provider
 * is a configured non-mock provider.
 */
export function paymentsEnabled(): boolean {
  return env("PAYMENTS_ENABLED", "false").toLowerCase() === "true";
}

/** Which provider abstraction to use: "mock" (default) | "stripe". */
export function paymentProviderName(): string {
  return env("PAYMENT_PROVIDER", "mock").toLowerCase();
}

/**
 * Whether *external* message delivery may be engaged. Default OFF, fail-safe.
 * The mock delivery simulation (clearly labelled "simulated") is part of the
 * prototype flow and never sends anything; a real outbound adapter additionally
 * requires MESSAGE_DELIVERY_ENABLED=true.
 */
export function messageDeliveryEnabled(): boolean {
  return env("MESSAGE_DELIVERY_ENABLED", "false").toLowerCase() === "true";
}

/** Delivery provider abstraction: "mock" (default) | "transactional" (future). */
export function deliveryProviderName(): string {
  return env("MESSAGE_DELIVERY_PROVIDER", "mock").toLowerCase();
}

/** Human-safe summary for the UI/health endpoint. Never reveals secrets. */
export function vaikutaFlags() {
  return {
    enabled: vaikutaEnabled(),
    publicCampaigns: publicCampaignsEnabled(),
    aiAssist: aiAssistEnabled(),
    payments: paymentsEnabled(),
    paymentProvider: paymentProviderName(),
    delivery: messageDeliveryEnabled(),
    deliveryProvider: deliveryProviderName(),
  };
}