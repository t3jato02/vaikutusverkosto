import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { getRecentChanges, getStats } from "@/lib/queries";
import { CHANGE_EVENT_LABELS } from "@/lib/constants";
import { relativeTime, formatDate } from "@/lib/format";

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
  const [changes, stats] = await Promise.all([getRecentChanges(8), getStats()]);
  return (
    <div className="space-y-10">
      <section className="pt-4 text-center sm:pt-10">
        <h1 className="mx-auto max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
          Näe, miten valta, raha ja päätökset liittyvät toisiinsa Suomessa.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-500 sm:text-base">
          Julkinen, lähdeperustainen verkosto suomalaisesta vallasta, rahasta ja
          institutionaalisista yhteyksistä. Ei syytöksiä — dokumentoidut tosiasiat ja lähteet.
        </p>
        <div className="mx-auto mt-6 max-w-2xl">
          <SearchBox big autoFocus />
          <p className="mt-2 text-xs text-ink-300">
            Hae henkilöä, yritystä, järjestöä, kuntaa tai päätöstä
          </p>
        </div>
      </section>

      <section aria-label="Tietokannan reaaliaikaiset tunnusluvut">
        <dl className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={stats.persons} label="Henkilöitä" />
          <Stat value={stats.organizations} label="Organisaatioita" />
          <Stat value={stats.verifiedRelationships} label="Varmennettuja yhteyksiä" />
          <Stat value={stats.sources} label="Lähteitä" />
        </dl>
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

      <section aria-label="Viimeisimmät varmennetut muutokset">
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
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card text-center">
      <dt className="text-2xl font-bold tabular-nums tracking-tight">{value.toLocaleString("fi-FI")}</dt>
      <dd className="mt-0.5 text-[11px] text-ink-500">{label}</dd>
    </div>
  );
}