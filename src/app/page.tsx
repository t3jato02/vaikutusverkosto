import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { getRecentChanges, getMoneyAggregates } from "@/lib/queries";
import { CHANGE_EVENT_LABELS } from "@/lib/constants";
import { formatEur, relativeTime, formatDate } from "@/lib/format";

const EXPLORE_SECTIONS = [
  { href: "/explore#politiikka", label: "Poliittinen valta", desc: "Eduskunta, hallitus, puolueet" },
  { href: "/explore#yritykset", label: "Yritysvalta", desc: "Yritykset, hallitukset, omistus" },
  { href: "/money", label: "Julkinen raha", desc: "Avustukset, hankinnat, lahjoitukset" },
  { href: "/explore#elake", label: "Eläkevalta", desc: "Eläkelaitokset ja hallinto" },
  { href: "/explore#media", label: "Media", desc: "Mediaomistus ja johto" },
  { href: "/explore#kunnat", label: "Kunnat", desc: "Kuntapäättäjät ja hankinnat" },
  { href: "/explore#yliopistot", label: "Yliopistot", desc: "Johto, rahoitus, kumppanuudet" },
  { href: "/explore#jarjestot", label: "Järjestöt", desc: "Yhdistykset, säätiöt, liitot" },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [changes, money] = await Promise.all([getRecentChanges(8), getMoneyAggregates()]);
  return (
    <div className="space-y-10">
      <section className="pt-4 text-center sm:pt-10">
        <h1 className="mx-auto max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
          Kuka vallitsee — minkä kautta — ja millä todisteilla?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-500 sm:text-base">
          Julkinen, lähdeperustainen verkosto suomalaisesta vallasta, rahasta ja
          institutionaalisista yhteyksistä. Ei syytöksiä — dokumentoidut tosiasiat ja lähteet.
        </p>
        <div className="mx-auto mt-6 max-w-2xl">
          <SearchBox big autoFocus />
          <p className="mt-2 text-xs text-ink-300">
            Hae henkilöä, yritystä, organisaatiota, kuntaa tai päätöstä
          </p>
        </div>
      </section>

      <section aria-label="Tutustuttavat alueet">
        <h2 className="card-title mb-3">TUTUSTU</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPLORE_SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="card group">
              <h3 className="text-sm font-semibold text-ink-900 group-hover:text-accent">{s.label}</h3>
              <p className="mt-0.5 text-xs text-ink-500">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Viimeisimmät varmennetut muutokset" className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title">VIIMEISIMMÄT VARMENNETUT MUUTOKSET</h2>
            <Link href="/changes" className="text-xs font-medium text-accent hover:underline">
              Kaikki →
            </Link>
          </div>
          <ul className="card divide-y divide-ink-100">
            {changes.length === 0 && <li className="py-3 text-sm text-ink-500">Ei muutoksia vielä.</li>}
            {changes.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-ink-900">
                    {c.entity?.canonicalName ?? "Järjestelmä"}
                  </span>
                  <p className="truncate text-xs text-ink-500">
                    {CHANGE_EVENT_LABELS[c.eventType]?.fi}: {c.description}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-300" title={formatDate(c.occurredAt)}>
                  {relativeTime(c.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title">SUURIMMAT DOKUMENTOIDUT RAHAVIRRAT</h2>
            <Link href="/money" className="text-xs font-medium text-accent hover:underline">
              Raha →
            </Link>
          </div>
          <ul className="card divide-y divide-ink-100">
            {money.byRecipient.length === 0 && (
              <li className="py-3 text-sm text-ink-500">
                Ei dokumentoituja rahavirtoja vielä. Rahavirtaominaisuus on rakennettu ja
                demotiedot on merkitty selvästi.
              </li>
            )}
            {money.byRecipient.map((r) => {
              const rec = money.recipients.find((x) => x.id === r.recipientEntityId);
              return (
                <li key={r.recipientEntityId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-sm text-ink-900">{rec?.canonicalName ?? "?"}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatEur(r._sum.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}