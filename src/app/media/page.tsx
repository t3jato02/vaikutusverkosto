import type { Metadata } from "next";
import Link from "next/link";
import { listMediaOutlets, listJournalists } from "@/lib/mediaQueries";
import { editorialAffiliationLabel, mediaOutletTypeLabel } from "@/lib/journalism";
import { entityUrlFor } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { TrustLegend } from "@/components/journalism/TrustLayer";

export const metadata: Metadata = {
  title: "Media",
  description:
    "Toimittajat & media: ketkä kirjoittavat vallankäyttäjistä, missä medioissa he työskentelevät, millaisista aiheista he kirjoittavat ja millaisia julkisesti dokumentoituja yhteyksiä media-alan toimijoilla on.",
};
export const dynamic = "force-dynamic";

export default async function MediaHubPage() {
  const [journalists, outlets] = await Promise.all([listJournalists({}), listMediaOutlets({})]);
  const topJournos = [...journalists].sort((a, b) => b.articleCount - a.articleCount).slice(0, 10);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-xl font-bold">Toimittajat & media</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
          Katso, ketkä kirjoittavat vallankäyttäjistä, missä medioissa he työskentelevät, millaisista aiheista he
          kirjoittavat ja millaisia julkisesti dokumentoituja yhteyksiä media-alan toimijoilla on. Kaikki perustuu
          jäljitettävään dataan — ei arvioihin.
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Ajankohtainen korpus on kontrolloitu pilotti QA:ta varten (media, toimittajat ja avoin lähdeaineisto);
          laajempi jatkuva käsittely on suunnitteilla.{" "}
          <Link href="/methodology#media" className="text-accent hover:underline">Menetelmät →</Link>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Toimittajat">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="card-title">TOIMITTAJAT</h2>
            <Link href="/toimittajat" className="text-xs text-accent hover:underline">Kaikki →</Link>
          </div>
          <ul className="card divide-y divide-ink-100">
            {topJournos.map((j) => (
              <li key={j.id}>
                <Link href={entityUrlFor(j.id, "PERSON", j.name, j.subtype)} className="flex items-center gap-3 py-2.5 hover:bg-ink-100/50">
                  <Avatar name={j.name} type="PERSON" size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{j.name}</span>
                  <span className="truncate text-xs text-ink-500">{j.employerName ?? ""}</span>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{j.articleCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Mediat">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="card-title">MEDIAT</h2>
            <Link href="/media" className="text-xs text-accent hover:underline" aria-label="Kaikki mediat (sama sivu)">
              Kaikki mediat
            </Link>
          </div>
          <ul className="card divide-y divide-ink-100">
            {outlets.map((o) => (
              <li key={o.id}>
                <Link href={entityUrlFor(o.id, "MEDIA_ORGANIZATION", o.name)} className="flex items-center gap-3 py-2.5 hover:bg-ink-100/50">
                  <Avatar name={o.name} type="MEDIA_ORGANIZATION" size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{o.name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {o.mediaOutletType ? mediaOutletTypeLabel(o.mediaOutletType as never) : "Media"}
                      {o.editorialAffiliationType !== "UNKNOWN" ? ` · ${editorialAffiliationLabel(o.editorialAffiliationType as never)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{o.journalistCount}</span>
                    <span className="text-[10px] uppercase text-ink-300">toimittajaa</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Vertailu" className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Vertaa medioita tai toimittajia</h2>
          <p className="mt-1 text-xs text-ink-500">Näytä puoluekohtainen käsittely ja juttutyyppijakaumat rinnakkain — ilman voittajaa.</p>
        </div>
        <Link href="/compare" className="btn-primary">Vertaa →</Link>
      </section>

      <section aria-label="Kansallisuuskehytysvertailu" className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Kansallisuus- ja paikallisuuskehytys</h2>
          <p className="mt-1 text-xs text-ink-500">
            Mittaa, miten mediat käyttävät kansallisuus- ja paikallisuusnimityksiä: ilmaukset, dokumentoidut
            syntymämaat ja käänteistapausvertailu.{" "}
            <Link href="/methodology#identity-framing" className="text-accent hover:underline">Menetelmät →</Link>
          </p>
        </div>
        <Link href="/media/identity-framing" className="btn-primary">Vertaa →</Link>
      </section>

      <TrustLegend />
    </div>
  );
}