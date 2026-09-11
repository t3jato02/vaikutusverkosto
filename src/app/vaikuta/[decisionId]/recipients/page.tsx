import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVerifiedUser, resolveWizardCampaign } from "@/lib/vaikuta/session";
import { db } from "@/lib/db";
import { Stepper } from "@/components/vaikuta/Stepper";
import RecipientPicker from "@/components/vaikuta/RecipientPicker";
import { planConfig } from "@/lib/vaikuta/pricing";

export const metadata: Metadata = { title: "Vastaanottajat — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function RecipientsStepPage({
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

  const recipients = await db.campaignRecipient.findMany({
    where: { campaignId: campaign.id },
    select: { entityId: true },
  });

  const plan = planConfig(campaign.planCode);
  const selected = recipients.map((r) => r.entityId);

  return (
    <div className="space-y-6">
      <Stepper current="recipients" />
      <header>
        <p className="label">VAIHE 2 · VASTAANOTTAJAT</p>
        <h1 className="mt-1 text-entity-title">Valitse vastaanottajat</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Ehdokkaat johdetaan dokumentoiduista institutionaalisista suhteista. Enintään{" "}
          <strong>{plan.recipientLimit}</strong> vastaanottajaa suunnitelmalla {plan.name}.
        </p>
      </header>

      <RecipientPicker
        decisionId={decisionId}
        campaignId={campaign.id}
        planLimit={plan.recipientLimit}
        initialSelected={selected}
      />
    </div>
  );
}