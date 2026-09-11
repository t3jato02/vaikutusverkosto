import Link from "next/link";
import { getTopConnected, getCommitteeSizes, getPartySizes, getMoneyAggregates, entityUrlFor } from "@/lib/queries";
import { getRecentBenefits, getTopAwardGivers } from "@/lib/mediaQueries";
import { db } from "@/lib/db";
import { entityLabel, FLOW_TYPE_LABELS } from "@/lib/constants";
import { benefitEventTypeLabel, valuePrecisionLabel } from "@/lib/benefits";
import { formatEur, formatNumber } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [topConnected, committees, parties, money, recentBenefits, awardGivers] = await Promise.all([
    getTopConnected(14),
    getCommitteeSizes(10),
    getPartySizes(),
    getMoneyAggregates(),
    getRecentBenefits(30),
    getTopAwardGivers(8),
  ]);

  const partyNames = new Map<string, string>();
  const partyIds = parties.map((p) => p.partyEntityId).filter(Boolean) as string[];
  if (partyIds.length) {
    const found = await db.entity.findMany({
      where: { id: { in: partyIds } },
      select: { id: true, canonicalName: true },
    });
    found.forEach((f) => partyNames.set(f.id, f.canonicalName));
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-xl font-bold">Tutki verkostoja</h1>
        <p className="mt-1 text-sm text-ink-500">
          Löydä toimijoita yhteyksien, rahan ja tehtävien kautta. Pyritään löytämään, ei provosoimaan.
        </p>
      </header>

      <section id="yhteydet">
        <h2 className="card-title mb-2">ENITEN YHTEYKSIÄ</h2>
        <ul className="card divide-y divide-ink-100">
          {topConnected.map((e, i) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-right text-sm font-bold tabular-nums text-ink-300">{i + 1}</span>
              <Avatar name={e.canonicalName} type={e.type as never} size={32} />
              <Link href={entityUrlFor(e.id, e.type as never, e.canonicalName)} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-accent">
                {e.canonicalName}
              </Link>
              <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">
                {entityLabel(e.type as never)}
              </span>
              <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{e.degree}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="valiokunnat" className="min-w-0">
          <h2 className="card-title mb-2">ENITEN JÄSENIÄ — VALIOKUNNAT</h2>
          <ul className="card divide-y divide-ink-100">
            {committees.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={entityUrlFor(c.id, "ORGANIZATION", c.canonicalName)} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-accent">
                  {c.canonicalName}
                </Link>
                <span className="shrink-0 text-sm tabular-nums text-ink-500">{c.members} jäsentä</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="puolueet" className="min-w-0">
          <h2 className="card-title mb-2">PUOLUEET KANSANEDUSTAJIEN MUKAAN</h2>
          <ul className="card divide-y divide-ink-100">
            {parties.map((p) => (
              <li key={p.partyEntityId ?? "?"} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {partyNames.get(p.partyEntityId!) ?? "—"}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-ink-500">
                  {formatNumber((p._count as { _all: number })._all ?? 0)} edustajaa
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section id="raha">
        <h2 className="card-title mb-2">RAHAVIRRAT TYYPIN MUKAAN</h2>
        {money.byType.length === 0 ? (
          <p className="text-sm text-ink-500">
            Ei dokumentoituja rahavirtoja vielä. Demotiedot (selvästi merkitty) näkyvät Raha-sivulla.
          </p>
        ) : (
          <ul className="card divide-y divide-ink-100">
            {money.byType.map((t) => (
              <li key={t.flowType} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">
                  {FLOW_TYPE_LABELS[t.flowType]?.fi ?? t.flowType}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatEur(t._sum.amount)} <span className="text-xs font-normal text-ink-300">({t._count._all} virtaa)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentBenefits.length > 0 && (
        <section id="palkinnot" aria-label="Palkinnot ja palkitut">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="card-title">PALKINNOT JA PALKITUT</h2>
            {awardGivers.length > 0 && (
              <span className="text-[11px] text-ink-500">
                Eniten dokumentoituja palkintoja:{" "}
                {awardGivers.map((g, i) => (
                  <span key={g.id}>
                    {i > 0 && " · "}
                    <Link href={entityUrlFor(g.id, "ORGANIZATION", g.name)} className="text-accent hover:underline">{g.name}</Link> ({g.awards})
                  </span>
                ))}
              </span>
            )}
          </div>
          <ul className="card divide-y divide-ink-100">
            {recentBenefits.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-wide text-ink-500">{benefitEventTypeLabel(b.eventType)}</span>
                  <span className="ml-1.5 text-sm font-medium text-ink-900">{b.title}</span>
                  {b.recipient && (
                    <Link href={entityUrlFor(b.recipient.id, "PERSON", b.recipient.canonicalName)} className="ml-1.5 text-sm text-accent hover:underline">
                      {b.recipient.canonicalName}
                    </Link>
                  )}
                  {b.giver && (
                    <span className="ml-1.5 text-[11px] text-ink-500">— {b.giver.canonicalName}</span>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-ink-500">
                  {b.eventDate ? String(b.eventDate.getFullYear()) : ""}
                  {b.monetaryValue !== null ? ` · ${formatEur(b.monetaryValue)} (${valuePrecisionLabel(b.valueType)})` : ""}
                  {b.sourceUrl && (
                    <>
                      {" · "}
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 min-w-0 lg:grid-cols-4">
        <PhaseCard id="yritykset" title="Yritysvalta" desc="Yritykset, hallitukset, omistus. YTJ- ja PRH-käsittely tulossa (vaihe B)." />
        <PhaseCard id="elake" title="Eläkevalta" desc="Eläkelaitosten johto, hallitukset ja sijoitukset. Vaihe A/B." />
        <PhaseCard id="media" title="Media" desc="Toimittajat, mediat, omistusketjut ja journalistinen tuotanto." href="/media" cta="Katso mediaa →" />
        <PhaseCard id="kunnat" title="Kunnat" desc="Kuntapäättäjät, avustukset, hankinnat. Vaihe B." />
      </div>
    </div>
  );
}

function PhaseCard({ id, title, desc, href, cta }: { id: string; title: string; desc: string; href?: string; cta?: string }) {
  const inner = (
    <>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{desc}</p>
      {cta && <p className="mt-2 text-xs font-medium text-accent">{cta}</p>}
    </>
  );
  if (href) {
    return (
      <section id={id} className="card group">
        <Link href={href} className="block group-hover:text-accent">{inner}</Link>
      </section>
    );
  }
  return (
    <section id={id} className="card">{inner}</section>
  );
}