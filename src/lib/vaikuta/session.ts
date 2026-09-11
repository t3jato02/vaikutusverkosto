// Server-component helpers for VAIKUTA wizard pages.

import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, isEmailVerified } from "@/lib/vaikuta/authUser";
import { getEntitlement } from "@/lib/vaikuta/entitlements";

export async function getVaikutaSession() {
  const user = await getCurrentUser();
  if (!user) return { user: null, entitlement: null };
  const entitlement = await getEntitlement(user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: isEmailVerified(user),
      identityLevel: user.emailVerifiedAt ? "email_verified" : "unverified",
      status: user.status,
    },
    entitlement,
  };
}

export async function requireAuthedUser() {
  const session = await getVaikutaSession();
  if (!session.user) redirect("/vaikuta/auth/signin");
  return session;
}

export async function requireVerifiedUser() {
  const session = await requireAuthedUser();
  if (!session.user!.emailVerified) redirect("/vaikuta/auth/verify-link");
  return session;
}

/** Resolve the wizard campaign: explicit ?campaign= else the user's latest one. */
export async function resolveWizardCampaign(userId: string, decisionId: string, campaignId?: string | null) {
  const where = { userId, decisionId };
  if (campaignId) {
    const campaign = await db.influenceCampaign.findFirst({ where: { id: campaignId, ...where } });
    if (campaign) return campaign;
  }
  return db.influenceCampaign.findFirst({ where, orderBy: { createdAt: "desc" } });
}

export async function getDecisionOr404(decisionId: string) {
  const decision = await db.decision.findUnique({
    where: { id: decisionId },
    include: {
      institutionEntity: { select: { id: true, canonicalName: true, type: true, subtype: true } },
      source: true,
      stages: { include: { source: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { votes: true, campaigns: true } },
    },
  });
  if (!decision) notFound();
  return decision;
}