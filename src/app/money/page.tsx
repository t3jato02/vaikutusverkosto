import Link from "next/link";
import { db } from "@/lib/db";
import { getMoneyAggregates, entityUrlFor } from "@/lib/queries";
import { FLOW_TYPE_LABELS } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import { publicVisibleWhere } from "@/lib/verification";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const [aggregates, flows] = await Promise.all([
    getMoneyAggregates(),
    db.financialFlow.findMany({
      where: publicVisibleWhere,
      orderBy: { amount: "desc" },
      take: 50,
      include: {
        payerEntity: { select: { id: true, canonicalName: true, type: true, description: true } },
        recipientEntity: { select: { id: true, canonicalName: true, type: true, description: true } },
        evidence: { include: { source: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-content space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-page-title">Raha</h1>
        <p className="mt-2 text-sm text-muted">
          <strong>Kaikki dokumentoidut rahavirrat</strong> — kotimaiset julkiset hankinnat,
          avustukset, EU-rahoitus, lahjoitukset, sijoitukset ja korvaukset. Summat esitetään
          lähdeperustaisesti; eri virtatyyppejä ei lasketa yhteen ilman avointa laskentatapaa.
          Vain rajat ylittävät rahavirrat:{" "}
          <Link href="/foreign" className="text-accent hover:underline">Kansainväliset yhteydet</Link>.
        </p>
      </header>

      <section aria-label="Virrat tyypin mukaan">
        <h2 className="section-title mb-2">Virrat tyypin mukaan</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {aggregates.byType.length === 0 && (
            <p className="col-span-full text-sm text-muted">
              Varmennettuja rahavirtoja lisätään lähde kerrallaan. Järjestelmä ei näytä
              esimerkkirahavirtoja tuotantodatana.
            </p>
          )}
          {aggregates.byType.map((t) => (
            <div key={t.flowType} className="card">
              <div className="text-base font-bold tabular-nums tracking-tight">{formatEur(t._sum.amount)}</div>
              <div className="mt-0.5 text-[11px] text-muted">{FLOW_TYPE_LABELS[t.flowType]?.fi ?? t.flowType}</div>
              <div className="text-[11px] text-ink-300">{t._count._all} virtaa</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Suurimmat rahavirrat">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Suurimmat dokumentoidut rahavirrat</h2>
          <Link href="/methodology#money" className="text-[11px] text-accent hover:underline">Laskentatapa →</Link>
        </div>
        <ul className="card divide-y divide-line">
          {flows.length === 0 && (
            <li className="py-4 text-sm text-muted">
              Varmennettuja rahavirtoja lisätään lähde kerrallaan. Järjestelmä ei näytä
              esimerkkirahavirtoja tuotantodatana.
            </li>
          )}
          {flows.map((f) => (
            <li key={f.id} id={`flow-${f.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <Link href={entityUrlFor(f.payerEntity.id, f.payerEntity.type, f.payerEntity.canonicalName)} className="font-medium text-ink hover:text-accent">
                    {f.payerEntity.canonicalName}
                  </Link>
                  <span className="text-accent" aria-hidden>→</span>
                  <Link href={entityUrlFor(f.recipientEntity.id, f.recipientEntity.type, f.recipientEntity.canonicalName)} className="font-medium text-ink hover:text-accent">
                    {f.recipientEntity.canonicalName}
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {FLOW_TYPE_LABELS[f.flowType]?.fi}
                  {f.purpose ? ` · ${f.purpose}` : ""}
                  {f.periodStart && <span className="text-ink-300"> · jakso: {f.periodStart.getFullYear()}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <span className="font-semibold tabular-nums text-ink">{formatEur(f.amount)}</span>
                {f.evidence[0]?.source && (
                  <a href={f.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-ink-200">
                    Näytä lähde
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
