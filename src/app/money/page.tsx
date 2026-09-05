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
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Julkinen raha</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Dokumentoidut rahavirrat: lahjoitukset, avustukset, hankinnat, sijoitukset ja korvaukset.
          Summat esitetään lähdeperustaisesti; eri virta-tyyppejä ei lasketa yhteen ilman
          avointa laskentatapaa. Järjestelmä ei näytä esimerkkirahavirtoja tuotantodatana.
        </p>
      </header>

      <section aria-label="Virrat tyypin mukaan">
        <h2 className="card-title mb-2">VIRRAT TYYPIN MUKAAN</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {aggregates.byType.length === 0 && (
            <p className="col-span-full text-sm text-ink-500">
              Varmennettuja rahavirtoja lisätään lähde kerrallaan. Järjestelmä ei näytä
              esimerkkirahavirtoja tuotantodatana.
            </p>
          )}
          {aggregates.byType.map((t) => (
            <div key={t.flowType} className="card">
              <div className="text-base font-bold tabular-nums tracking-tight">
                {formatEur(t._sum.amount)}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-500">
                {FLOW_TYPE_LABELS[t.flowType]?.fi ?? t.flowType}
              </div>
              <div className="text-[11px] text-ink-300">{t._count._all} virtaa</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Suurimmat rahavirrat">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="card-title">SUURIMMAT DOKUMENTOIDUT RAHAVIRRAT</h2>
          <Link href="/methodology#money" className="text-[11px] text-accent hover:underline">
            Laskentatapa →
          </Link>
        </div>
        <ul className="card divide-y divide-ink-100">
          {flows.length === 0 && (
            <li className="py-4 text-sm text-ink-500">
              Varmennettuja rahavirtoja lisätään lähde kerrallaan. Järjestelmä ei näytä
              esimerkkirahavirtoja tuotantodatana.
            </li>
          )}
          {flows.map((f) => {
            return (
              <li key={f.id} id={`flow-${f.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={entityUrlFor(f.payerEntity.id, f.payerEntity.type, f.payerEntity.canonicalName)} className="font-medium text-ink-900 hover:text-accent">
                      {f.payerEntity.canonicalName}
                    </Link>
                    <span className="text-accent" aria-hidden>→</span>
                    <Link href={entityUrlFor(f.recipientEntity.id, f.recipientEntity.type, f.recipientEntity.canonicalName)} className="font-medium text-ink-900 hover:text-accent">
                      {f.recipientEntity.canonicalName}
                    </Link>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {FLOW_TYPE_LABELS[f.flowType]?.fi} · {f.purpose}
                    {f.periodStart && (
                      <span className="text-ink-300"> · jakso: {f.periodStart.getFullYear()}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="font-semibold tabular-nums text-ink-900">{formatEur(f.amount)}</span>
                  {f.evidence[0]?.source && (
                    <a href={f.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-ink-200">
                      Näytä lähde
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}