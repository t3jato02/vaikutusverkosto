// VAIKUTA message delivery provider abstraction (section 12).
//
// Actual delivery is DISABLED initially. The MockDeliveryProvider simulates a
// realistic lifecycle (queued → accepted → simulated_delivered / failed) and
// never sends anything. A real transactional provider requires
// MESSAGE_DELIVERY_ENABLED=true AND a configured adapter — neither exists yet.
//
// Systematic safety: recipient/campaign controls are enforced at the domain
// level (see safety.ts and entitlements.ts), independent of any provider's
// capability for bulk sending. The product intentionally does NOT depend on a
// "blast one identical email to thousands" mechanism.

import { messageDeliveryEnabled, deliveryProviderName } from "@/lib/vaikuta/flags";
import type { CampaignDeliveryState } from "@/lib/vaikuta/types";

export interface DeliveryReceipt {
  provider: string;
  externalRef: string;
  state: CampaignDeliveryState;
  simulated: boolean;
}

export interface MessageDeliveryProvider {
  readonly name: string;
  isReal(): boolean;
  /** Submit a campaign for delivery; mock simulates immediately. */
  submit(input: { campaignId: string; recipientCount: number }): Promise<DeliveryReceipt>;
  getStatus(externalRef: string): Promise<{ state: CampaignDeliveryState }>;
  /** Policy check the domain layer uses before any submit. */
  canEngageRealDelivery(): boolean;
}

export const SIMULATED_STATES = ["QUEUED", "ACCEPTED", "SIMULATED_DELIVERED", "FAILED"] as const;

class MockDeliveryProvider implements MessageDeliveryProvider {
  readonly name = "mock";
  isReal(): boolean {
    return false;
  }
  canEngageRealDelivery(): boolean {
    return false;
  }
  async submit(input: { campaignId: string; recipientCount: number }): Promise<DeliveryReceipt> {
    void input;
    const externalRef = `mock-delivery-${input.campaignId.slice(0, 8)}-${Date.now().toString(36)}`;
    // Deterministic simulation: campaigns with > 0 recipients succeed.
    const failed = input.recipientCount === 0;
    return {
      provider: "mock",
      externalRef,
      state: failed ? "FAILED" : "SIMULATED_DELIVERED",
      simulated: true,
    };
  }
  async getStatus(externalRef: string): Promise<{ state: CampaignDeliveryState }> {
    void externalRef;
    // A previously simulated delivery stays simulated.
    return { state: "SIMULATED_DELIVERED" };
  }
}

/** Reserved adapter for a future transactional provider — never engaged yet. */
class TransactionalDeliveryProvider implements MessageDeliveryProvider {
  readonly name = "transactional";
  isReal(): boolean {
    return true;
  }
  canEngageRealDelivery(): boolean {
    // Still impossible today: no adapter config exists and the kill switch is off.
    return messageDeliveryEnabled();
  }
  async submit(): Promise<DeliveryReceipt> {
    throw new Error("No transactional delivery adapter is configured. Real delivery is disabled.");
  }
  async getStatus(): Promise<{ state: CampaignDeliveryState }> {
    throw new Error("No transactional delivery adapter is configured.");
  }
}

let deliverySingleton: MessageDeliveryProvider | null = null;

export function getDeliveryProvider(): MessageDeliveryProvider {
  if (deliverySingleton) return deliverySingleton;
  const name = deliveryProviderName();
  deliverySingleton = name === "transactional" && messageDeliveryEnabled() ? new TransactionalDeliveryProvider() : new MockDeliveryProvider();
  return deliverySingleton;
}

export function __resetDeliveryProvider(): void {
  deliverySingleton = null;
}