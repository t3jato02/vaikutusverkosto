// VAIKUTA server-side entitlement engine.
//
// The browser never decides price, plan, recipient limit or campaign
// allowance. Every operation that consumes an entitlement is re-derived here
// from the pricing config + the user's own stored records:
//   1. Active subscription (or FREE).
//   2. Campaigns executed in the current window.
//   3. The campaign's own stored planCode (validated, never client-priced).
//
// A "paid execution" requires a SUCCEEDED payment for a one-time campaign pass
// OR an active subscription covering the plan with allowance remaining.

import { db } from "@/lib/db";
import { planConfig, pricingVersion, type PlanConfig } from "@/lib/vaikuta/pricing";

const PERIOD_DAYS = 30;
const EXECUTABLE_STATUSES = ["DRAFT", "RECIPIENTS_SELECTED", "MESSAGE_READY", "APPROVED", "CHECKOUT_READY", "PAYMENT_COMPLETED", "DELIVERED"] as const;

export interface Entitlement {
  userId: string;
  planCode: string;
  plan: PlanConfig;
  pricingVersion: string;
  /** Campaigns executed (payment SUCCEEDED) in the current window, still active. */
  executedInWindow: number;
  canExecute: boolean;
  recipientLimit: number;
}

export async function getActiveSubscription(userId: string) {
  return db.vaikutaSubscription.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const sub = await getActiveSubscription(userId);
  const planCode = sub?.plan.code ?? "FREE";
  // The pricing config is the single source of truth — the DB row is a mirror.
  const plan = planConfig(planCode);

  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const executedInWindow = await db.influenceCampaign.count({
    where: {
      userId,
      paymentStatus: "SUCCEEDED",
      status: { in: [...EXECUTABLE_STATUSES] },
      createdAt: { gte: since },
    },
  });

  const allowance = plan.campaignAllowance;
  const canExecute = allowance !== null ? executedInWindow < allowance : false;

  return {
    userId,
    planCode,
    plan,
    pricingVersion: pricingVersion(),
    executedInWindow,
    canExecute,
    recipientLimit: plan.recipientLimit,
  };
}

/**
 * The effective plan config for executing a given campaign: prefer the user's
 * active subscription if it at least satisfies the campaign's target plan,
 * otherwise the campaign's own stored planCode (validated against config).
 */
export function effectivePlanForCampaign(entitlement: Entitlement, campaignPlanCode: string): PlanConfig {
  const target = planConfig(campaignPlanCode);
  const active = entitlement.plan;
  const activeOk =
    entitlement.planCode !== "FREE" &&
    recipientLimitAtLeast(active, target) &&
    allowanceAtLeast(active, target);
  return activeOk ? active : target;
}

function recipientLimitAtLeast(a: PlanConfig, b: PlanConfig): boolean {
  if (a.recipientLimit === b.recipientLimit) return true;
  return a.recipientLimit > b.recipientLimit;
}

function allowanceAtLeast(a: PlanConfig, b: PlanConfig): boolean {
  if (a.campaignAllowance === null && b.campaignAllowance === null) return true;
  if (a.campaignAllowance === null) return true;
  if (b.campaignAllowance === null) return false;
  return a.campaignAllowance >= b.campaignAllowance;
}

export interface CheckoutDecision {
  chargeMinor: number;
  chargeCurrency: string;
  oneTime: boolean; // true = one-time campaign pass; false = first subscription period
  coveredBySubscription: boolean;
  effectivePlanCode: string;
}

/** Server-side decision of what a campaign checkout must charge. */
export async function decideCheckout(userId: string, campaignPlanCode: string): Promise<CheckoutDecision> {
  const entitlement = await getEntitlement(userId);
  const effective = effectivePlanForCampaign(entitlement, campaignPlanCode);
  // FREE (and any plan with zero campaign allowance) can never execute a
  // campaign — a user must not be able to re-price a campaign to €0.
  if (effective.campaignAllowance === 0 || effective.priceMinor === 0) {
    const err = new Error("plan_not_executable") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  const activeCovers =
    entitlement.planCode !== "FREE" &&
    recipientLimitAtLeast(entitlement.plan, effective) &&
    allowanceAtLeast(entitlement.plan, effective) &&
    entitlement.canExecute;

  const oneTime = effective.billingPeriod === "one_time";
  return {
    chargeMinor: activeCovers ? 0 : effective.priceMinor,
    chargeCurrency: effective.currency,
    oneTime,
    coveredBySubscription: activeCovers,
    effectivePlanCode: effective.code,
  };
}