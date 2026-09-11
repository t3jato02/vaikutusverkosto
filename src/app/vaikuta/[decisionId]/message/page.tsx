import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVerifiedUser, resolveWizardCampaign } from "@/lib/vaikuta/session";
import { Stepper } from "@/components/vaikuta/Stepper";
import MessageComposer from "@/components/vaikuta/MessageComposer";

export const metadata: Metadata = { title: "Viesti — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function MessageStepPage({
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

  return (
    <div className="space-y-6">
      <Stepper current="message" />
      <header>
        <p className="label">VAIHE 3 · VIESTI</p>
        <h1 className="mt-1 text-entity-title">Kirjoita näkemyksesi</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Kirjoita omin sanoin. AI-avustaja sulkee merkitystä muuttamatta: se ei keksi argumentteja.
        </p>
      </header>

      {campaign.status === "REQUIRES_MODERATION" && (
        <aside role="alert" className="card border-warning/50 bg-warning-soft">
          <p className="text-[13px] text-ink-700">
            Tämä viesti ohjataan tarkistettavaksi ennakoivan suojan perusteella. Voit muokata tekstiä;
            toimitus ei etene ennen kuin tarkistus on valmis.
          </p>
        </aside>
      )}

      <MessageComposer
        decisionId={decisionId}
        campaignId={campaign.id}
        initialSubject={campaign.messageSubject ?? ""}
        initialBody={campaign.messageBody ?? ""}
        planCode={campaign.planCode}
      />
    </div>
  );
}