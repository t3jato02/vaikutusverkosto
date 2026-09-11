import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getVaikutaFunnel } from "@/lib/vaikuta/events";
import { CAMPAIGN_STATUS_LABELS, DELIVERY_STATE_LABELS } from "@/lib/vaikuta/types";
import { formatDate, formatNumber } from "@/lib/format";
import AdminCampaignActions from "@/components/vaikuta/AdminCampaignActions";

export const metadata: Metadata = { title: "Vaikuta-hallinta" };
export const dynamic = "force-dynamic";

export default async function AdminVaikutaPage() {
  const funnel = await getVaikutaFunnel();
  const [campaignCount, moderationQueue, suspended, delivered, payments, sessions, recipients, sourceFailures] = await Promise.all([
    db.influenceCampaign.count(),
    db.influenceCampaign.findMany({ where: { status: "REQUIRES_MODERATION" }, orderBy: { updatedAt: "desc" }, take: 50 }),
    db.influenceCampaign.count({ where: { status: "SUSPENDED" } }),
    db.influenceCampaign.count({ where: { status: "DELIVERED" } }),
    db.vaikutaPayment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountMinor: true } }),
    db.vaikutaCheckoutSession.groupBy({ by: ["status"], _count: { _all: true } }),
    db.campaignRecipient.count(),
    db.campaignRecipient.count({ where: { contactAvailability: "not_verified" } }),
  ]);

  const recentCampaigns = await db.influenceCampaign.findMany({
    include: { decision: { select: { title: true } }, _count: { select: { recipients: true } }, user: { select: { email: true } } },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const stats = [
    { label: "Kampanjoita", value: campaignCount },
    { label: "Vastaanottajia", value: recipients },
    { label: "Toimitettuja (simuloitu)", value: delivered },
    { label: "Keskeytettyjä", value: suspended },
    { label: "Tarkistusjonossa", value: moderationQueue.length },
    { label: "Yhteystietoja vahvistamatta", value: sourceFailures },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Vaikuta-hallinta</h1>
        <p className="mt-1 text-sm text-ink-500">
          Kampanjat, moderaatio, toimitus- ja laskutustila (prototyyppi). Jokainen toimenpide auditoidaan.
        </p>
      </header>

      <section aria-label="Kattavuus">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="card">
              <div className="text-xl font-bold tabular-nums tracking-tight">{formatNumber(s.value)}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Suppilo">
        <h2 className="card-title mb-2">SUPPILO</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <FunnelStat label="Avauksia" value={funnel.vaikutaOpened} />
          <FunnelStat label="Kampanjoita" value={funnel.campaignsCreated} />
          <FunnelStat label="Vastaanottajat valittu" value={funnel.receivedRecipientSelection} />
          <FunnelStat label="Viesti hyväksytty" value={funnel.messagesApproved} />
          <FunnelStat label="Kassa aloitettu" value={funnel.checkoutsStarted} />
          <FunnelStat label="Mock-maksuja" value={funnel.mockCheckoutsCompleted} />
          <FunnelStat label="Valmistuneita" value={funnel.campaignsCompleted} />
        </div>
      </section>

      <section aria-label="Laskutus-/maksutila (mock)">
        <h2 className="card-title mb-2">MAKSU-/LASKUTUSTILA (MOCK)</h2>
        <ul className="card divide-y divide-line text-xs">
          {payments.map((p) => (
            <li key={p.status} className="py-2">
              <span className="font-medium">{p.status}</span> · {p._count._all} kpl · {formatNumber(p._sum.amountMinor ?? 0)} centtiä
            </li>
          ))}
          {sessions.map((s) => (
            <li key={s.status} className="py-2 text-ink-500">
              Kassassio: {s.status} · {s._count._all}
            </li>
          ))}
          <li className="py-2 text-ink-500">Huom: maksujen kokonaissummat ovat simuloituja (ei oikeita veloituksia).</li>
        </ul>
      </section>

      <section aria-label="Moderaatiojono">
        <h2 className="card-title mb-2">TARKISTUSJONO ({moderationQueue.length})</h2>
        {moderationQueue.length === 0 ? (
          <p className="card text-sm text-ink-500">Ei odottavia tapauksia.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {moderationQueue.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/vaikuta/campaign/${c.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                    {c.title}
                  </Link>
                  <span className="text-[11px] text-ink-500">{c.abuseReason ?? ""}</span>
                </div>
                <div className="mt-1 text-[12px] text-ink-500">
                  Päätös: {c.decisionId} · päivitetty {formatDate(c.updatedAt)}
                </div>
                <AdminCampaignActions campaignId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Kampanjat">
        <h2 className="card-title mb-2">KAIKKI KAMPANJAT ({recentCampaigns.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] table-fixed text-left text-xs">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-300">
              <tr>
                <th className="px-3 py-2">Kampanja</th>
                <th className="px-3 py-2">Käyttäjä</th>
                <th className="px-3 py-2">Tila</th>
                <th className="px-3 py-2">Maksu</th>
                <th className="px-3 py-2">Toimitus</th>
                <th className="px-3 py-2">Vastaanottajia</th>
                <th className="px-3 py-2">Toimet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentCampaigns.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-3 py-2">
                    <Link href={`/vaikuta/campaign/${c.id}`} className="font-medium text-ink-900 hover:underline">
                      {c.title}
                    </Link>
                    <span className="block text-ink-300">{c.decision.title}</span>
                  </td>
                  <td className="px-3 py-2 text-ink-500">{c.user?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                    {c.abuseFlaggedAt ? " ⚑" : ""}
                  </td>
                  <td className="px-3 py-2">{c.paymentStatus ?? "—"}</td>
                  <td className="px-3 py-2">{DELIVERY_STATE_LABELS[c.deliveryStatus] ?? c.deliveryStatus}</td>
                  <td className="px-3 py-2 tabular-nums">{c._count.recipients}</td>
                  <td className="px-3 py-2">
                    <AdminCampaignActions campaignId={c.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-lg font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{label}</div>
    </div>
  );
}