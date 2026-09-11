import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVerifiedUser, resolveWizardCampaign } from "@/lib/vaikuta/session";
import { Stepper } from "@/components/vaikuta/Stepper";
import CheckoutLauncher, { type PlanOption } from "@/components/vaikuta/CheckoutLauncher";
import { PrototypeBanner } from "@/components/vaikuta/PrototypeBanner";
import { activePlans } from "@/lib/vaikuta/pricing";
import { getActiveSubscription } from "@/lib/vaikuta/entitlements";

export const metadata: Metadata = { title: "Kassa — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function CheckoutStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ decisionId: string }>;
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { decisionId } = await params;
  const { campaign: campaignParam } = await searchParams;
  const session = await requireVerifiedUser();
  const campaign = await resolveWizardCampaign(session.user!.id, decisionId, campaignParam);
  if (!campaign) redirect(`/vaikuta/${encodeURIComponent(decisionId)}`);

  if (!campaign.messageBody || !(campaign.status === "APPROVED" || campaign.status === "CHECKOUT_READY")) {
    redirect(`/vaikuta/${encodeURIComponent(decisionId)}/preview?campaign=${encodeURIComponent(campaign.id)}`);
  }

  const sub = await getActiveSubscription(session.user!.id);
  const plans: PlanOption[] = activePlans()
    .filter((p) => p.code !== "FREE") // FREE is a browse/draft tier — never an execution plan
    .map((p) => ({
      code: p.code,
      name: p.name,
      billingPeriod: p.billingPeriod,
      priceMinor: p.priceMinor,
      recipientLimit: p.recipientLimit,
      tagline: p.tagline,
    }));

  return (
    <div className="space-y-6">
      <Stepper current="checkout" />
      <header>
        <p className="label">VAIHE 5 · KASSA</p>
        <h1 className="mt-1 text-entity-title">Suunnitelma ja prototyyppikassa</h1>
      </header>

      <PrototypeBanner />

      <CheckoutLauncher
        campaignId={campaign.id}
        decisionId={decisionId}
        currentPlan={campaign.planCode}
        plans={plans}
        hasActiveSubscription={sub !== null}
      />
    </div>
  );
}