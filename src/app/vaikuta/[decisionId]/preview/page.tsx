import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVerifiedUser, resolveWizardCampaign } from "@/lib/vaikuta/session";
import { db } from "@/lib/db";
import { Stepper } from "@/components/vaikuta/Stepper";
import ApproveToCheckout from "@/components/vaikuta/ApproveToCheckout";
import { planConfig } from "@/lib/vaikuta/pricing";

export const metadata: Metadata = { title: "Esikatselu — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function PreviewStepPage({
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

  if (!campaign.messageBody) {
    redirect(`/vaikuta/${encodeURIComponent(decisionId)}/message?campaign=${encodeURIComponent(campaign.id)}`);
  }

  const recipients = await db.campaignRecipient.findMany({
    where: { campaignId: campaign.id },
    include: { entity: { select: { id: true, canonicalName: true } }, source: true },
    orderBy: { createdAt: "asc" },
  });
  const decision = await db.decision.findUnique({
    where: { id: decisionId },
    include: { source: true },
  });

  const plan = planConfig(campaign.planCode);
  const sender = session.user!.email;

  return (
    <div className="space-y-6">
      <Stepper current="preview" />
      <header>
        <p className="label">VAIHE 4 · ESIKATSELU</p>
        <h1 className="mt-1 text-entity-title">Tarkista ennen lähettämistä</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Sinä hyväksyt lopullisen tekstin. Vaikutusverkosto ei muokkaa sitä tämän jälkeen.
        </p>
      </header>

      <section className="card space-y-4" aria-label="Esikatselu">
        <div className="border-b border-line pb-3">
          <p className="label">Viesti</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-500">Lähettäjä:</dt>
              <dd className="text-ink-900">{sender}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-500">Otsikko:</dt>
              <dd className="text-ink-900">{campaign.messageSubject}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-500">Maalia:</dt>
              <dd className="text-ink-900">{recipients.length} vastaanottajaa</dd>
            </div>
          </dl>
        </div>

        <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-700">{campaign.messageBody}</pre>

        <div className="border-t border-line pt-3 text-[12px] text-ink-500">
          <p><strong className="font-medium">Viitattava päätös:</strong> {decision?.title ?? "—"}</p>
          {decision?.source && (
            <p>
              <strong className="font-medium">Lähteet:</strong>{" "}
              <a href={decision.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {decision.source.sourceName}
              </a>
            </p>
          )}
        </div>
      </section>

      <section aria-label="Vastaanottajat">
        <h2 className="section-title mb-2">Vastaanottajat ({recipients.length})</h2>
        <ul className="card divide-y divide-line">
          {recipients.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-ink-900">{r.entity.canonicalName}</span>
                {r.recipientRole && <span className="ml-2 text-xs text-ink-500">{r.recipientRole}</span>}
                {r.isMedia && (
                  <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">Media</span>
                )}
                {r.recipientReason && <p className="mt-0.5 text-[12px] text-muted">{r.recipientReason}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-ink-500">
                {r.source ? <a href={r.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a> : "ei varmistettua yhteystietoa"}
              </span>
            </li>
          ))}
          {recipients.length === 0 && <li className="py-3 text-sm text-ink-500">Ei valittuja vastaanottajia.</li>}
        </ul>
      </section>

      {campaign.status === "REQUIRES_MODERATION" ? (
        <aside role="alert" className="card border-warning/50 bg-warning-soft">
          <p className="text-[13px] text-ink-700">
            Tämä kampanja odottaa ennakoivaa tarkistusta. Lähetystä ei voida käynnistää ennen kuin
            ylläpito on käsitellyt lipun. Voit palata muokkaamaan tekstiä.
          </p>
          <a href={`/vaikuta/${encodeURIComponent(decisionId)}/message?campaign=${encodeURIComponent(campaign.id)}`} className="mt-2 inline-block text-[13px] text-accent hover:underline">
            ← Muokkaa viestiä
          </a>
        </aside>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href={`/vaikuta/${encodeURIComponent(decisionId)}/message?campaign=${encodeURIComponent(campaign.id)}`} className="text-sm text-accent hover:underline">
            ← Muokkaa viestiä
          </a>
          <ApproveToCheckout campaignId={campaign.id} decisionId={decisionId} />
        </div>
      )}

      <p className="text-[12px] text-ink-500">
        Suunnitelma: {plan.name} · hinta {plan.priceMinor === 0 ? "€0" : `${(plan.priceMinor / 100).toFixed(2).replace(".", ",")} €`} · vastaanottajaraja {plan.recipientLimit}
      </p>
    </div>
  );
}