import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedCampaign } from "@/lib/vaikuta/campaigns";
import { getVaikutaSession } from "@/lib/vaikuta/session";
import { publicCampaignsEnabled } from "@/lib/vaikuta/flags";
import { CAMPAIGN_STATUS_LABELS, DELIVERY_STATE_LABELS } from "@/lib/vaikuta/types";
import SimulateDelivery from "@/components/vaikuta/SimulateDelivery";
import PublishCampaign from "@/components/vaikuta/PublishCampaign";
import { PrototypeBanner, SimulatedTag } from "@/components/vaikuta/PrototypeBanner";

export const metadata: Metadata = { title: "Kampanjahallinta" };
export const dynamic = "force-dynamic";

export default async function CampaignDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getVaikutaSession();
  const campaign = session.user ? await getOwnedCampaign(session.user.id, id) : null;
  if (!campaign) notFound();

  const recipients = campaign.recipients;
  const deliveredCount = recipients.filter((r) => r.deliveryStatus === "SIMULATED_DELIVERED").length;
  const awaitingCount = recipients.filter((r) => r.responseStatus === "awaiting_reply").length;
  const repliedCount = recipients.filter((r) => (r.responseStatus ?? "") === "reply").length;
  const failedCount = recipients.filter((r) => r.deliveryStatus === "FAILED").length;
  const mediaCount = recipients.filter((r) => r.isMedia).length;
  const isDelivered = campaign.deliveryStatus === "SIMULATED_DELIVERED";

  const events = campaign.events;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label">KAMPANJA</p>
          <h1 className="mt-1 text-entity-title">{campaign.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {campaign.decision.institutionEntity?.canonicalName ?? "—"} ·{" "}
            <span className={campaign.status === "SUSPENDED" ? "text-red-700" : ""}>
              {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
            </span>
            {campaign.isDemo && <span className="ml-2 text-[11px] text-ink-300">(demo)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.publicVisibility === "PUBLIC" && (
            <Link href={`/vaikuta/campaign/${campaign.id}/public`} className="btn">
              Julkinen sivu
            </Link>
          )}
          <Link href={`/decision/${campaign.decisionId}`} className="btn">
            Päätöksen profiili
          </Link>
        </div>
      </header>

      <PrototypeBanner compact />

      {campaign.abuseFlaggedAt && (
        <aside role="alert" className="card border-warning/50 bg-warning-soft">
          <p className="text-[13px] text-ink-700">
            Tämä kampanja on merkitty ennakoivaan tarkistukseen ({campaign.abuseReason ?? "syy"}). Ylläpito
            käsittelee tapauksen; toimitus on estetty siihen asti.
          </p>
        </aside>
      )}

      <section aria-label="Tilanne">
        <h2 className="section-title mb-2">Tilanne</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Lähetetty (simuloitu)" value={isDelivered ? recipients.length : 0} />
          <Stat label="Toimitettu (simuloitu)" value={deliveredCount} />
          <Stat label="Vastauksia" value={repliedCount} />
          <Stat label="Odottaa vastausta" value={awaitingCount} />
          <Stat label="Epäonnistuneet" value={failedCount} />
          <Stat label="Media vastaanottajina" value={mediaCount} />
        </div>
      </section>

      <section aria-label="Viesti" className="card space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="card-title">Viestisi</h2>
          <SimulatedTag />
        </div>
        <p className="text-[12px] text-ink-500">
          <strong className="font-medium">Otsikko:</strong> {campaign.messageSubject ?? "—"}
        </p>
        <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-700">
          {campaign.messageBody ?? "Ei viestiä vielä."}
        </pre>
        <p className="text-[12px] text-ink-500">Lähettäjä: {campaign.user?.email ?? "—"}</p>
      </section>

      <section aria-label="Vastaanottajat">
        <h2 className="section-title mb-2">Vastaanottajat ({recipients.length})</h2>
        <ul className="card divide-y divide-line">
          {recipients.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-ink-900">{r.entity.canonicalName}</span>
                {r.recipientRole && <span className="ml-2 text-xs text-ink-500">{r.recipientRole}</span>}
                {r.isMedia && (
                  <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">Media</span>
                )}
                {r.recipientReason && <p className="mt-0.5 text-[12px] text-muted">{r.recipientReason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px] text-ink-500">
                <span>{r.source ? <a href={r.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a> : "ei lähdetietoja"}</span>
                <span>{DELIVERY_STATE_LABELS[r.deliveryStatus] ?? r.deliveryStatus}</span>
                {r.responseStatus === "awaiting_reply" && <span className="text-ink-300">odottaa vastausta</span>}
              </div>
            </li>
          ))}
          {recipients.length === 0 && <li className="py-3 text-sm text-ink-500">Ei valittuja vastaanottajia.</li>}
        </ul>
      </section>

      <section aria-label="Toimitus">
        <h2 className="section-title mb-2">Toimitus</h2>
        <div className="card space-y-3">
          <p className="text-[13px] text-ink-700">
            Tila: <strong>{DELIVERY_STATE_LABELS[campaign.deliveryStatus] ?? campaign.deliveryStatus}</strong>
            {campaign.deliveryProvider ? ` · palvelu: ${campaign.deliveryProvider}` : ""}
          </p>
          {campaign.paymentStatus === "SUCCEEDED" && !isDelivered ? (
            <SimulateDelivery campaignId={campaign.id} />
          ) : isDelivered ? (
            <p className="text-[13px] text-ink-500">
              Toimitus on simuloitu. Seuraava askel on vastausten kirjaaminen (tuleva ominaisuus).
            </p>
          ) : (
            <p className="text-[13px] text-ink-500">Toimitus edellyttää suunnitelman maksun simulointia.</p>
          )}
        </div>
      </section>

      <section aria-label="Julkinen kampanjasivu">
        <h2 className="section-title mb-2">Julkinen kampanjasivu</h2>
        <div className="card space-y-3">
          <p className="text-[13px] text-ink-700">
            Julkiset sivut ovat oletuksena pois päältä ja voimassa vain erillisen lipun kautta.
          </p>
          {publicCampaignsEnabled() && campaign.paymentStatus === "SUCCEEDED" && campaign.publicVisibility !== "PUBLIC" ? (
            <PublishCampaign campaignId={campaign.id} />
          ) : campaign.publicVisibility === "PUBLIC" ? (
            <Link href={`/vaikuta/campaign/${campaign.id}/public`} className="text-[13px] text-accent hover:underline">
              Näytä julkinen sivu →
            </Link>
          ) : (
            <p className="text-[12px] text-ink-500">Julkiset kampanjat eivät ole käytössä tässä ympäristössä.</p>
          )}
        </div>
      </section>

      <section aria-label="Tapahtumat">
        <h2 className="section-title mb-2">Auditointihistoria</h2>
        <ol className="card divide-y divide-line">
          {events.length === 0 && <li className="py-3 text-sm text-ink-500">Ei tapahtumia.</li>}
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-xs">
              <span className="font-medium text-ink-900">{e.type}</span>
              <span className="text-ink-300">{e.createdAt.toLocaleString("fi-FI")}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{label}</div>
    </div>
  );
}