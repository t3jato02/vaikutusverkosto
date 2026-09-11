// VAIKUTA campaign domain operations. All wizard steps funnel through these
// server-side functions so that no client value is ever trusted for price,
// plan, recipient limits or campaign allowance. Every state transition appends
// an immutable CampaignEvent (audit trail).

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDecisionRecipients, getDecisionMedia, type RecipientCandidate } from "@/lib/vaikuta/relevance";
import { planConfig, pricingVersion } from "@/lib/vaikuta/pricing";
import { checkMessage, checkCampaignRateLimits, findOverlappingCampaign, contentHash, type SafetyFlag } from "@/lib/vaikuta/safety";
import { decideCheckout } from "@/lib/vaikuta/entitlements";
import { getPaymentProvider } from "@/lib/vaikuta/payments";
import { getDeliveryProvider } from "@/lib/vaikuta/delivery";
import { trackVaikuta } from "@/lib/vaikuta/events";

// ---------------------------------------------------------------- events

export async function addCampaignEvent(campaignId: string, type: string, metadata?: Record<string, string | number | boolean | null>) {
  await db.campaignEvent.create({ data: { campaignId, type, metadata: metadata ?? undefined } });
}

export async function getCampaignView(campaignId: string) {
  const campaign = await db.influenceCampaign.findUnique({
    where: { id: campaignId },
    include: {
      decision: {
        include: {
          institutionEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
          source: true,
          stages: { include: { source: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      recipients: {
        include: { entity: { select: { id: true, canonicalName: true, type: true, subtype: true } }, source: true },
        orderBy: { createdAt: "asc" },
      },
      events: { orderBy: { createdAt: "asc" }, take: 200 },
      user: { select: { id: true, email: true } },
    },
  });
  return campaign;
}

export async function assertOwner(userId: string, campaign: { userId: string }): Promise<void> {
  if (campaign.userId !== userId) {
    const err = new Error("forbidden") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

/** Resolve a campaign for the owner (or null). */
export async function getOwnedCampaign(userId: string, campaignId: string) {
  const campaign = await getCampaignView(campaignId);
  if (!campaign || campaign.userId !== userId) return null;
  return campaign;
}

// ---------------------------------------------------------------- plans

/** Seed/refresh the VaikutaPlan mirror rows from the central pricing config. */
export async function ensurePlans(): Promise<void> {
  const codes = ["FREE", "VAIKUTA_PASS", "VAIKUTA_PLUS", "VAIKUTA_PRO", "ORGANIZATION"];
  for (const code of codes) {
    const cfg = planConfig(code);
    await db.vaikutaPlan.upsert({
      where: { code },
      update: {
        name: cfg.name,
        billingPeriod: cfg.billingPeriod,
        priceMinor: cfg.priceMinor,
        currency: cfg.currency,
        recipientLimit: cfg.recipientLimit,
        campaignAllowance: cfg.campaignAllowance,
        aiAssist: cfg.aiAssist,
        monitoring: cfg.monitoring,
        features: cfg.features as unknown as Prisma.InputJsonValue,
      },
      create: {
        code,
        name: cfg.name,
        billingPeriod: cfg.billingPeriod,
        priceMinor: cfg.priceMinor,
        currency: cfg.currency,
        recipientLimit: cfg.recipientLimit,
        campaignAllowance: cfg.campaignAllowance,
        aiAssist: cfg.aiAssist,
        monitoring: cfg.monitoring,
        features: cfg.features as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

// ---------------------------------------------------------------- creation

export interface CreateCampaignInput {
  title: string;
  planCode: string;
}

export async function createDraftCampaign(userId: string, decisionId: string, input: CreateCampaignInput) {
  const allowedCodes = ["FREE", "VAIKUTA_PASS", "VAIKUTA_PLUS", "VAIKUTA_PRO", "ORGANIZATION"];
  const planCode = allowedCodes.includes(input.planCode) ? input.planCode : "VAIKUTA_PASS";
  const title = input.title.trim().slice(0, 160);

  const rl = await checkCampaignRateLimits(userId);
  if (!rl.allowed) {
    const err = new Error(rl.reason ?? "campaign_rate_limited") as Error & { status?: number; code?: string };
    err.status = 429;
    err.code = rl.reason;
    throw err;
  }

  if (await filterDuplicate(userId, decisionId, title)) {
    const err = new Error("duplicate_campaign") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "duplicate_campaign";
    throw err;
  }

  const cfg = planConfig(planCode);
  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.influenceCampaign.create({
      data: {
        userId,
        decisionId,
        status: "DRAFT",
        title,
        planCode,
        planSnapshot: {
          code: cfg.code,
          name: cfg.name,
          priceMinor: cfg.priceMinor,
          currency: cfg.currency,
          recipientLimit: cfg.recipientLimit,
          campaignAllowance: cfg.campaignAllowance,
          billingPeriod: cfg.billingPeriod,
        } as unknown as Prisma.InputJsonValue,
        pricingVersion: pricingVersion(),
      },
    });
    await tx.campaignEvent.create({
      data: { campaignId: created.id, type: "created", metadata: { planCode } },
    });
    return created;
  });

  await ensurePlans();
  await trackVaikuta({ eventType: "campaign_created", userId, campaignId: campaign.id, decisionId, metadata: { planCode } });
  return campaign;
}

async function filterDuplicate(userId: string, decisionId: string, title: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const same = await db.influenceCampaign.findFirst({
    where: { userId, decisionId, title, createdAt: { gte: since }, status: { notIn: ["CLOSED", "SUSPENDED"] } },
    select: { id: true },
  });
  return same !== null;
}

// ---------------------------------------------------------------- recipients

export interface EligibleRecipient extends RecipientCandidate {
  alreadySelected: boolean;
}

/** Eligible candidates for a decision (decision makers + preparation + media). */
export async function getEligibleForDecision(decisionId: string): Promise<EligibleRecipient[]> {
  const [makers, media] = await Promise.all([getDecisionRecipients(decisionId), getDecisionMedia(decisionId)]);
  return [...makers, ...media].map((c) => ({ ...c, alreadySelected: false }));
}

export async function saveRecipients(input: {
  userId: string;
  campaign: { id: string; userId: string; planCode: string };
  entityIds: string[];
  decisionId: string;
}) {
  await assertOwner(input.userId, input.campaign);
  const cfg = planConfig(input.campaign.planCode);

  const unique = [...new Set(input.entityIds)];
  if (unique.length > cfg.recipientLimit) {
    const err = new Error("recipient_limit_exceeded") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "recipient_limit_exceeded";
    throw err;
  }

  const eligible = await getEligibleForDecision(input.decisionId);
  const eligibleIds = new Set(eligible.map((e) => e.entityId));
  const unsourced = unique.filter((id) => !eligibleIds.has(id));
  if (unsourced.length > 0) {
    const err = new Error("recipient_not_eligible") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "recipient_not_eligible";
    throw err;
  }

  const byId = new Map(eligible.map((e) => [e.entityId, e]));

  await db.$transaction(async (tx) => {
    await tx.campaignRecipient.deleteMany({ where: { campaignId: input.campaign.id } });
    let n = 0;
    for (const id of unique) {
      const cand = byId.get(id);
      if (!cand) continue;
      await tx.campaignRecipient.create({
        data: {
          campaignId: input.campaign.id,
          entityId: id,
          recipientRole: cand.role,
          recipientReason: cand.reasonText,
          relevanceDimension: cand.dimension,
          isMedia: cand.isMedia,
          relationshipType: cand.relationshipType,
          sourceId: cand.sourceId || null,
          confidence: cand.confidence as never ?? "HIGH",
          verifiedAt: cand.verifiedAt,
          contactAvailability: cand.contactAvailability,
        },
      });
      n += 1;
    }
    await tx.campaignEvent.create({
      data: {
        campaignId: input.campaign.id,
        type: "recipient_added",
        metadata: { count: n, mediaCount: unique.filter((id) => byId.get(id)?.isMedia).length },
      },
    });
  });

  await db.influenceCampaign.update({
    where: { id: input.campaign.id },
    data: { status: "RECIPIENTS_SELECTED" },
  });
  await trackVaikuta({ eventType: "recipient_selected", userId: input.userId, campaignId: input.campaign.id, decisionId: input.decisionId, metadata: { count: unique.length } });
  return unique.length;
}

// ---------------------------------------------------------------- message

export interface SaveMessageResult {
  ok: boolean;
  errors: string[];
  flags: SafetyFlag[];
  requiresModeration: boolean;
}

export async function saveMessage(input: {
  userId: string;
  campaign: { id: string; userId: string; status: string };
  subject: string;
  body: string;
  decisionId: string;
}): Promise<SaveMessageResult> {
  await assertOwner(input.userId, input.campaign);
  const check = checkMessage(input.subject, input.body);

  if (!check.ok) {
    return { ok: false, errors: check.errors, flags: check.flags, requiresModeration: false };
  }

  const overlapping = await findOverlappingCampaign({
    userId: input.userId,
    decisionId: input.decisionId,
    bodyHash: contentHash(check.body),
  });
  if (overlapping.length > 0) {
    return { ok: false, errors: ["duplicate_campaign"], flags: [], requiresModeration: false };
  }

  const requiresModeration = check.flags.length > 0;
  await db.influenceCampaign.update({
    where: { id: input.campaign.id },
    data: {
      messageSubject: check.subject,
      messageBody: check.body,
      status: requiresModeration ? "REQUIRES_MODERATION" : "MESSAGE_READY",
      abuseFlaggedAt: requiresModeration ? new Date() : null,
      abuseReason: requiresModeration ? check.flags.map((f) => f.code).join(",") : null,
    },
  });
  await addCampaignEvent(input.campaign.id, requiresModeration ? "moderation_required" : "message_updated", {
    flagCount: check.flags.length,
  });

  return { ok: true, errors: [], flags: check.flags, requiresModeration };
}

// ---------------------------------------------------------------- approval

export async function approveMessage(input: {
  userId: string;
  campaign: { id: string; userId: string; status: string; messageBody: string | null };
}) {
  await assertOwner(input.userId, input.campaign);
  if (!input.campaign.messageBody) {
    const err = new Error("message_missing") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  await db.$transaction(async (tx) => {
    await tx.influenceCampaign.update({
      where: { id: input.campaign.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    await tx.campaignEvent.create({ data: { campaignId: input.campaign.id, type: "message_approved" } });
  });
}

// ---------------------------------------------------------------- checkout

export interface StartedCheckout {
  sessionId: string;
  amountMinor: number;
  currency: string;
  isMock: boolean;
  redirectUrl: string | null;
  effectivePlanCode: string;
  coveredBySubscription: boolean;
}

export async function startCheckout(input: {
  userId: string;
  campaign: { id: string; userId: string; planCode: string; status: string };
  baseUrl: string;
}): Promise<StartedCheckout> {
  await assertOwner(input.userId, input.campaign);
  if (input.campaign.status === "SUSPENDED") {
    const err = new Error("campaign_suspended") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  if (input.campaign.status === "REQUIRES_MODERATION") {
    const err = new Error("campaign_requires_moderation") as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  const decision = await decideCheckout(input.userId, input.campaign.planCode);
  const provider = getPaymentProvider();
  const sessionId = crypto.randomUUID();
  const amount = decision.chargeMinor;

  await db.$transaction(async (tx) => {
    await tx.vaikutaCheckoutSession.create({
      data: {
        id: sessionId,
        userId: input.userId,
        campaignId: input.campaign.id,
        amountMinor: amount,
        currency: decision.chargeCurrency,
        status: "IN_PROGRESS",
        provider: provider.name,
        isMock: provider.isMock(),
      },
    });
    if (amount > 0) {
      await tx.vaikutaPayment.create({
        data: {
          userId: input.userId,
          checkoutSessionId: sessionId,
          amountMinor: amount,
          currency: decision.chargeCurrency,
          status: "PENDING",
          provider: provider.name,
          isMock: provider.isMock(),
        },
      });
    }
    await tx.influenceCampaign.update({
      where: { id: input.campaign.id },
      data: { status: "CHECKOUT_READY", planCode: decision.effectivePlanCode },
    });
    await tx.campaignEvent.create({
      data: {
        campaignId: input.campaign.id,
        type: "checkout_started",
        metadata: { amountMinor: amount, oneTime: decision.oneTime, covered: decision.coveredBySubscription },
      },
    });
  });

  await trackVaikuta({
    eventType: "checkout_started",
    userId: input.userId,
    campaignId: input.campaign.id,
    metadata: { amountMinor: amount, mock: provider.isMock() },
  });

  let redirectUrl: string | null = null;
  if (!provider.isMock()) {
    const live = await provider.createCheckout({
      userId: input.userId,
      campaignId: input.campaign.id,
      planCode: decision.effectivePlanCode,
      amountMinor: amount,
      currency: decision.chargeCurrency,
      successUrl: `${input.baseUrl}/vaikuta/checkout/ok`,
      cancelUrl: `${input.baseUrl}`,
    });
    redirectUrl = live.redirectUrl;
  }

  return {
    sessionId,
    amountMinor: amount,
    currency: decision.chargeCurrency,
    isMock: provider.isMock(),
    redirectUrl,
    effectivePlanCode: decision.effectivePlanCode,
    coveredBySubscription: decision.coveredBySubscription,
  };
}

export interface ConfirmResult {
  paymentId: string | null;
  amountMinor: number;
  coveredBySubscription: boolean;
  isMock: boolean;
}

export async function confirmCheckout(input: { userId: string; sessionId: string }): Promise<ConfirmResult> {
  const session = await db.vaikutaCheckoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.userId !== input.userId) {
    const err = new Error("checkout_session_not_found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  if (session.status === "COMPLETED") {
    const payment = await db.vaikutaPayment.findFirst({ where: { checkoutSessionId: session.id } });
    return {
      paymentId: payment?.id ?? null,
      amountMinor: session.amountMinor,
      coveredBySubscription: session.amountMinor === 0,
      isMock: session.isMock,
    };
  }
  if (session.status !== "IN_PROGRESS") {
    const err = new Error("checkout_session_not_in_progress") as Error & { status?: number };
    err.status = 409;
    throw err;
  }

  const campaign = await db.influenceCampaign.findUnique({ where: { id: session.campaignId ?? "" } });
  if (!campaign || campaign.userId !== input.userId) {
    const err = new Error("forbidden") as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  // The amount is ALWAYS re-derived server-side at confirm time — never from
  // the client. A tampered session (e.g. €14.90 → €0) is re-priced here: the
  // recorded amount is corrected and the mock charge raised accordingly.
  const decision = await decideCheckout(input.userId, campaign.planCode);
  const authoritativeAmount = decision.chargeMinor;

  const provider = getPaymentProvider();
  if (!provider.isMock()) {
    throw new Error("confirmCheckout is only valid for the mock provider.");
  }

  await db.$transaction(async (tx) => {
    await tx.vaikutaCheckoutSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    const payment = await tx.vaikutaPayment.findFirst({ where: { checkoutSessionId: session.id } });
    if (payment) {
      // Re-price to the authoritative amount (corrects any client-tampered €0).
      await tx.vaikutaPayment.update({
        where: { id: payment.id },
        data: { amountMinor: authoritativeAmount, status: "SUCCEEDED", metadata: { method: "mock_card" } },
      });
    } else if (authoritativeAmount > 0) {
      await tx.vaikutaPayment.create({
        data: {
          userId: input.userId,
          checkoutSessionId: session.id,
          amountMinor: authoritativeAmount,
          currency: decision.chargeCurrency,
          status: "SUCCEEDED",
          provider: "mock",
          isMock: true,
          metadata: { method: "mock_card" },
        },
      });
    }

    // Persist the pricing snapshot BEFORE any entitlement is honoured.
    const cfg = planConfig(campaign.planCode);
    await tx.influenceCampaign.update({
      where: { id: campaign.id },
      data: {
        paymentStatus: "SUCCEEDED",
        status: "PAYMENT_COMPLETED",
        planCode: decision.effectivePlanCode,
        planSnapshot: {
          code: cfg.code,
          name: cfg.name,
          priceMinor: cfg.priceMinor,
          currency: cfg.currency,
          recipientLimit: cfg.recipientLimit,
          campaignAllowance: cfg.campaignAllowance,
          billingPeriod: cfg.billingPeriod,
          chargedMinor: authoritativeAmount,
          chargedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.campaignEvent.create({
      data: {
        campaignId: campaign.id,
        type: "payment_simulated",
        metadata: { amountMinor: authoritativeAmount, covered: authoritativeAmount === 0 },
      },
    });

    // One-time PASS needs no subscription; monthly plans activate the entitlement.
    if (decision.oneTime) {
      await tx.vaikutaSubscription.updateMany({
        where: { userId: input.userId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
    } else {
      await ensurePlans();
      const planRow = await tx.vaikutaPlan.findUnique({ where: { code: decision.effectivePlanCode } });
      await tx.vaikutaSubscription.upsert({
        where: { id: (await tx.vaikutaSubscription.findFirst({ where: { userId: input.userId, plan: { code: decision.effectivePlanCode }, status: "ACTIVE" } }))?.id ?? "" },
        update: { currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        create: {
          userId: input.userId,
          planId: planRow?.id ?? "",
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          provider: "mock",
        },
      });
    }
  });

  const payment = await db.vaikutaPayment.findFirst({ where: { checkoutSessionId: session.id } });
  await trackVaikuta({
    eventType: "mock_checkout_completed",
    userId: input.userId,
    campaignId: campaign.id,
    decisionId: campaign.decisionId,
    metadata: { amountMinor: authoritativeAmount, mock: true },
  });

  return {
    paymentId: payment?.id ?? null,
    amountMinor: authoritativeAmount,
    coveredBySubscription: authoritativeAmount === 0,
    isMock: true,
  };
}

// ---------------------------------------------------------------- delivery

export async function simulateDelivery(input: { userId: string; campaign: { id: string; userId: string; paymentStatus: string | null; status: string } }) {
  await assertOwner(input.userId, input.campaign);
  if (input.campaign.paymentStatus !== "SUCCEEDED") {
    const err = new Error("payment_required") as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  const recipients = await db.campaignRecipient.findMany({ where: { campaignId: input.campaign.id } });
  const provider = getDeliveryProvider();
  if (provider.isReal()) {
    // Real delivery would require MESSAGE_DELIVERY_ENABLED=true AND an adapter.
    throw new Error("real delivery is disabled");
  }

  const receipt = await provider.submit({ campaignId: input.campaign.id, recipientCount: recipients.length });
  await db.$transaction(async (tx) => {
    await tx.influenceCampaign.update({
      where: { id: input.campaign.id },
      data: {
        deliveryStatus: receipt.state,
        status: "DELIVERED",
        deliveryProvider: provider.name,
        deliveryProviderState: { externalRef: receipt.externalRef, simulated: receipt.simulated } as unknown as Prisma.InputJsonValue,
        preparedMessageAt: new Date(),
      },
    });
    for (const r of recipients) {
      await tx.campaignRecipient.update({
        where: { id: r.id },
        data: { deliveryStatus: receipt.state, responseStatus: "awaiting_reply" },
      });
    }
    await tx.campaignEvent.create({
      data: { campaignId: input.campaign.id, type: "delivery_simulated", metadata: { externalRef: receipt.externalRef, simulated: true, recipientCount: recipients.length } },
    });
  });

  await trackVaikuta({
    eventType: "campaign_completed",
    userId: input.userId,
    campaignId: input.campaign.id,
    metadata: { simulated: true },
  });
  return receipt;
}

// ---------------------------------------------------------------- moderation & admin

export async function setCampaignModeration(input: { campaignId: string; status: "REQUIRES_MODERATION" | "MESSAGE_READY"; reason?: string }) {
  await db.$transaction(async (tx) => {
    await tx.influenceCampaign.update({
      where: { id: input.campaignId },
      data: {
        status: input.status,
        abuseFlaggedAt: input.status === "REQUIRES_MODERATION" ? new Date() : null,
        abuseReason: input.status === "REQUIRES_MODERATION" ? input.reason ?? null : null,
      },
    });
    await tx.campaignEvent.create({
      data: {
        campaignId: input.campaignId,
        type: input.status === "REQUIRES_MODERATION" ? "moderation_required" : "message_updated",
        metadata: { reason: input.reason ?? null },
      },
    });
  });
}