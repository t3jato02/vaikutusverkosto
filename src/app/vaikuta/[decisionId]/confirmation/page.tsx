import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVerifiedUser, resolveWizardCampaign } from "@/lib/vaikuta/session";
import { Stepper } from "@/components/vaikuta/Stepper";

export const metadata: Metadata = { title: "Vahvistus — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function ConfirmationStepPage({
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
  if (campaign.paymentStatus !== "SUCCEEDED") {
    redirect(`/vaikuta/${encodeURIComponent(decisionId)}/checkout?campaign=${encodeURIComponent(campaign.id)}`);
  }

  return (
    <div className="space-y-6">
      <Stepper current="confirmation" />

      <section className="card-pad border-verified/40" aria-label="Vahvistus">
        <p className="label text-verified">VALMIS</p>
        <h1 className="mt-1 text-entity-title">Kampanja on valmisteltu</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-700">
          Prototyyppitilassa ei ole veloitettu maksua eikä lähetetty yhtään viestiä ulkopuolisille.
          Alla oleva toimitusnäkymä on simulaatio, joka näyttää tulevan toimituslogiikan.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/vaikuta/campaign/${campaign.id}`} className="btn-primary">
            Avaa kampanjahallinta
          </Link>
          <Link href="/vaikuta" className="btn">Vaikuta-aloittelu</Link>
        </div>
      </section>
    </div>
  );
}