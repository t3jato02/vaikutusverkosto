// VAIKUTA analytics events — privacy-conscious product analytics.
//
// Rule (section 16): full political message contents NEVER enter analytics
// event payloads. Message content belongs in InfluenceCampaign domain storage
// with its own access controls. Metadata here is limited to counts and kind.

import { db } from "@/lib/db";

export const VAIKUTA_EVENT_TYPES = [
  "vaikuta_opened",
  "decision_selected",
  "recipient_list_viewed",
  "recipient_selected",
  "message_started",
  "ai_assist_used",
  "preview_opened",
  "checkout_started",
  "mock_checkout_completed",
  "campaign_created",
  "campaign_completed",
  "campaign_published",
] as const;

export type VaikutaEventType = (typeof VAIKUTA_EVENT_TYPES)[number];

export async function trackVaikuta(input: {
  eventType: VaikutaEventType;
  userId?: string | null;
  campaignId?: string | null;
  decisionId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    await db.vaikutaEvent.create({
      data: {
        eventType: input.eventType,
        userId: input.userId ?? null,
        campaignId: input.campaignId ?? null,
        decisionId: input.decisionId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch {
    // Analytics must never break the main flow.
  }
}

export interface VaikutaFunnel {
  vaikutaOpened: number;
  campaignsCreated: number;
  receivedRecipientSelection: number;
  messagesApproved: number;
  checkoutsStarted: number;
  mockCheckoutsCompleted: number;
  campaignsCompleted: number;
}

/** Administrative funnel (section 16). No message contents anywhere. */
export async function getVaikutaFunnel(): Promise<VaikutaFunnel> {
  const [opened, created, selected, approved, started, completedCharge, done] = await Promise.all([
    db.vaikutaEvent.count({ where: { eventType: "vaikuta_opened" } }),
    db.influenceCampaign.count({ where: { status: { not: "DRAFT" } } }),
    db.influenceCampaign.count({ where: { status: { in: ["RECIPIENTS_SELECTED", "MESSAGE_READY", "APPROVED", "CHECKOUT_READY", "PAYMENT_COMPLETED", "DELIVERED"] } } }),
    db.influenceCampaign.count({ where: { approvedAt: { not: null } } }),
    db.vaikutaCheckoutSession.count({ where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } } }),
    db.vaikutaPayment.count({ where: { status: "SUCCEEDED", isMock: true } }),
    db.influenceCampaign.count({ where: { status: { in: ["DELIVERED", "PAYMENT_COMPLETED"] } } }),
  ]);
  return {
    vaikutaOpened: opened,
    campaignsCreated: created,
    receivedRecipientSelection: selected,
    messagesApproved: approved,
    checkoutsStarted: started,
    mockCheckoutsCompleted: completedCharge,
    campaignsCompleted: done,
  };
}