// /media/identity-framing — kansallisuus- ja paikallisuuskehystyksen
// vertailutyökalu (luvut 4, 11, 12).
//
// Purpose: make the media's terminology measurable — not to prove a
// pre-defined political claim. Every panel shows its sample size and refuses
// conclusions when the sample is too small (INSUFFICIENT_SAMPLE.

import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { computeAndStoreIdentityAggregate } from "@/lib/analysis/identity/aggregate";
import { computeAndStoreReverseComparison } from "@/lib/analysis/identity/reverse";
import { identityTermCategoryLabel, identityTermCategoryDescription } from "@/lib/identityFraming";
import { MIN_ANALYSIS_SAMPLE, INSUFFICIENT_SAMPLE } from "@/lib/analysis/identity/safety";
import { formatPct } from "@/lib/analysis/identity/stats";

export const metadata: Metadata = {
  title: "Kansallisuus- ja paikallisuuskehytys — vertailu",
  description:
    "Mittaa, miten suomalaiset mediat käyttävät kansallisuus- ja paikallisuusnimityksiä. Lähdeperustainen, auditoitava sanastoanalyysi.",
};
export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "2010-2015", start: new Date("2010-01-01"), end: new Date("2015-12-31") },
  { key: "2016-2020", start: new Date("2016-01-01"), end: new Date("2020-12-31") },
  { key: "2021-2026", start: new Date("2021-01-01"), end: new Date("2026-12-31") },
];

export default async function IdentityFramingComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const mediaFilter = asList(sp.media);
  const categoryFilter = asString(sp.category);
  const termFilter = asString(sp.term);
  const birthCountry = asString(sp.birthCountry);
  const citizenship = asString(sp.citizenship);
  const residenceCountry = asString(sp.residence);
  const fromYear = asString(sp.from);
  const toYear = asString(sp.to);

  const outlets = await db.entity.findMany({
    where: { type: "MEDIA_ORGANIZATION", subtype: "MEDIA_OUTLET" },
    select: { id: true, canonicalName: true },
    orderBy: { canonicalName: "asc" },
  });
  const outletIds = mediaFilter.length > 0 ? mediaFilter : outlets.map((o) => o.id);

  const [corpusAgg, mediaAggs, periodAggs, reverse] = await Promise.all([
    computeAndStoreIdentityAggregate({
      scope: "CORPUS",
      categoryFilter,
      termFilter,
      birthCountry,
      citizenship,
      residenceCountry,
      periodStart: fromYear ? new Date(`${fromYear}-01-01`) : null,
      periodEnd: toYear ? new Date(`${toYear}-12-31`) : null,
    }),
    Promise.all(outletIds.slice(0, 6).map((id) =>
      computeAndStoreIdentityAggregate({ scope: "OUTLET", entityId: id })),
    ),
    Promise.all(PERIODS.map((p) =>
      computeAndStoreIdentityAggregate({ scope: "CORPUS", periodStart: p.start, periodEnd: p.end })),
    ),
    computeAndStoreReverseComparison(),
  ]);

  const outletName = new Map(outlets.map((o) => [o.id, o.canonicalName]));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-xl font-bold">Kansallisuus- ja paikallisuuskehytys — vertailu</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
          Mittaa, millä perusteella mediat käyttävät kansallisuus- ja paikallisuusnimityksiä. Jokainen paneli
          näyttää otoskokonsa ja kieltäytyy johtopäätöksistä, kun otos on liian pieni. Järjestelmä ei oleta
          puolueellisuutta etukäteen — se kerää aineiston ja näyttää sen.{" "}
          <Link href="/methodology#identity-framing" className="text-accent hover:underline">Menetelmät →</Link>
        </p>
      </header>

      {/* filters */}
      <form method="get" action="/media/identity-framing" className="card-pad space-y-3">
        <h2 className="text-[12px] font-bold uppercase tracking-wide text-ink-900">Suodattimet</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[11px] text-ink-500">
            Media
            <select name="media" className="input mt-1 w-full" defaultValue={mediaFilter[0] ?? ""}>
              <option value="">Kaikki mediat</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.canonicalName}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-ink-500">
            Ilmausluokka
            <select name="category" className="input mt-1 w-full" defaultValue={categoryFilter ?? ""}>
              <option value="">Kaikki luokat</option>
              {[
                "NATIONALITY",
                "CITIZENSHIP",
                "RESIDENCE",
                "PLACE_OF_BIRTH",
                "IMMIGRATION_STATUS",
                "CITY_IDENTITY",
              ].map((c) => (
                <option key={c} value={c}>{identityTermCategoryLabel(c)}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-ink-500">
            Syntymämaa (ISO2)
            <input name="birthCountry" className="input mt-1 w-full" placeholder="esim. FI, NP, US" defaultValue={birthCountry ?? ""} />
          </label>
          <label className="block text-[11px] text-ink-500">
            Kansalaisuus (ISO2)
            <input name="citizenship" className="input mt-1 w-full" placeholder="esim. FI" defaultValue={citizenship ?? ""} />
          </label>
          <label className="block text-[11px] text-ink-500">
            Asuinmaa (ISO2)
            <input name="residence" className="input mt-1 w-full" placeholder="esim. FI, CH, MC" defaultValue={residenceCountry ?? ""} />
          </label>
          <label className="block text-[11px] text-ink-500">
            Vuodesta
            <input name="from" type="number" min="2000" max="2030" className="input mt-1 w-full" defaultValue={fromYear ?? ""} />
          </label>
          <label className="block text-[11px] text-ink-500">
            Vuoteen
            <input name="to" type="number" min="2000" max="2030" className="input mt-1 w-full" defaultValue={toYear ?? ""} />
          </label>
        </div>
        <button className="btn-primary">Suodata</button>
      </form>

      {/* reverse comparison */}
      <section aria-label="Käänteistapausvertailu">
        <h2 className="section-title mb-2">Käänteistapausvertailu</h2>
        <p className="mb-2 text-xs text-ink-500">
          Ulkomailla syntynyt → Suomi (A) vs. Suomessa syntynyt → ulkomaille (B). Parit on muodostettu
          mahdollisimman samankaltaisista tapauksista (ikä, julkinen rooli, kansalaisuudet, asumisen kesto).
        </p>
        <ReverseComparisonPanel reverse={reverse} />
      </section>

      {/* media vs media */}
      <section aria-label="Medioiden vertailu">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Medioiden vertailu</h2>
          <span className="meta">{outletIds.length} mediaa valittuna</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {mediaAggs.map((agg, i) => (
            <div key={agg.scopeEntityId ?? i} className="card-pad">
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-900">
                {agg.scopeEntityId ? outletName.get(agg.scopeEntityId) ?? "Media" : "—"}
              </h3>
              {agg.corpus.mentionCount === 0 ? (
                <p className="mt-2 text-xs text-ink-500">Ei identiteettimainintoja korpuksessa.</p>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {agg.corpus.mentionCount} mainintaa · {agg.corpus.personCount} henkilöä · dokumentointiaste{" "}
                    {Math.round((agg.documentation.rate ?? 0) * 100)} %
                  </p>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {agg.terms.slice(0, 5).map((t) => (
                      <li key={t.expression} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="truncate text-ink-700">“{t.expression}”</span>
                        <span className="shrink-0 tabular-nums text-ink-400">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                  {!agg.sampleSufficient && (
                    <p className="mt-2 text-[10px] text-ink-400">{INSUFFICIENT_SAMPLE} — ei johtopäätöksiä.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* period comparison */}
      <section aria-label="Aikajaksovertailu">
        <h2 className="section-title mb-2">Aikajaksovertailu</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {periodAggs.map((agg) => (
            <div key={agg.period.start ?? "?"} className="card-pad">
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-900">
                {agg.period.start} — {agg.period.end}
              </h3>
              {agg.corpus.mentionCount === 0 ? (
                <p className="mt-2 text-xs text-ink-500">Ei mainintoja ajanjaksolla.</p>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-ink-400">{agg.corpus.mentionCount} mainintaa</p>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {agg.terms.slice(0, 4).map((t) => (
                      <li key={t.expression} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="truncate text-ink-700">“{t.expression}”</span>
                        <span className="shrink-0 tabular-nums text-ink-400">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* filtered corpus */}
      <section aria-label="Aineisto suodattimilla">
        <h2 className="section-title mb-2">Aineisto suodattimilla</h2>
        <div className="card-pad">
          <p className="mb-2 text-xs text-ink-500">
            {corpusAgg.corpus.mentionCount} mainintaa · {corpusAgg.corpus.personCount} henkilöä ·{" "}
            {corpusAgg.corpus.articleCount} juttua · dokumentointiaste {Math.round((corpusAgg.documentation.rate ?? 0) * 100)} %
          </p>
          {corpusAgg.corpus.mentionCount === 0 ? (
            <p className="text-sm text-ink-500">
              Ei mainintoja näillä suodattimilla. Yhdistelmät, joista ei ole tietoa, näytetään tyhjinä — ei
              arvauksia.

            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <ul className="divide-y divide-ink-100">
                {corpusAgg.terms.slice(0, 15).map((t) => (
                  <li key={t.expression} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="truncate text-ink-700">
                      “{t.expression}”{" "}
                      <span className="text-[11px] text-ink-400" title={identityTermCategoryDescription(t.category)}>
                        {identityTermCategoryLabel(t.category)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-400">{t.count}</span>
                  </li>
                ))}
              </ul>
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase text-ink-500">Ilmaus vs. syntymämaa</h3>
                <ul className="divide-y divide-ink-100">
                  {corpusAgg.birthCountryCross.slice(0, 8).map((c) => (
                    <li key={c.expression} className="py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink-700">“{c.expression}”</span>
                        <span className="shrink-0 tabular-nums text-ink-400">{c.total}</span>
                      </div>
                      <p className="text-[10px] text-ink-400">
                        {c.birthCountryFI} × syntymämaa Suomi · {c.birthCountryForeign} × ulkomailla · {c.unknownBirth} tuntematon
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ReverseComparisonPanel({ reverse }: { reverse: Awaited<ReturnType<typeof computeAndStoreReverseComparison>> }) {
  const insufficient = reverse.status === INSUFFICIENT_SAMPLE || !reverse.outcome;
  return (
    <div className="card-pad space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
        <span>Kohortti A: <strong className="text-ink-900">{reverse.sampleSizeA}</strong> henkilöä (ulkomailla syntynyt → Suomi)</span>
        <span>Kohortti B: <strong className="text-ink-900">{reverse.sampleSizeB}</strong> henkilöä (Suomessa syntynyt → ulkomaille)</span>
        <span>Parit: <strong className="text-ink-900">{reverse.matchedPairs}</strong></span>
        <span>Matching-laatu: <strong className="text-ink-900">{Math.round((reverse.matchingQuality ?? 0) * 100)} %</strong></span>
        <span>Puuttuva data: <strong className="text-ink-900">{Math.round((reverse.missingDataRate ?? 0) * 100)} %</strong></span>
      </div>

      {insufficient ? (
        <p className="rounded-lg border border-dashed border-ink-300 bg-surface px-3 py-2 text-[12px] text-ink-500">
          {INSUFFICIENT_SAMPLE} — aineisto on liian pieni johtopäätöksiin (vaaditaan vähintään {MIN_ANALYSIS_SAMPLE} tapausta kussakin kohortissa ja paria).
          Tilastollista efektiä ei väitetä; havainnot näytetään sellaisinaan.{" "}
          <Link href="/methodology#identity-framing" className="text-accent hover:underline">Menetelmät →</Link>
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-400">A: “suomalainen”</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatPct(reverse.outcome!.proportionA.p)}
            </p>
            <p className="text-[11px] text-ink-400">
              {reverse.outcome!.proportionA.successes} / {reverse.outcome!.proportionA.n} · 95 % CI{" "}
              {formatPct(reverse.outcome!.proportionA.low)}–{formatPct(reverse.outcome!.proportionA.high)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-400">B: “suomalainen”</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatPct(reverse.outcome!.proportionB.p)}
            </p>
            <p className="text-[11px] text-ink-400">
              {reverse.outcome!.proportionB.successes} / {reverse.outcome!.proportionB.n} · 95 % CI{" "}
              {formatPct(reverse.outcome!.proportionB.low)}–{formatPct(reverse.outcome!.proportionB.high)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-400">Efekti (Cohenin h)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {reverse.outcome!.cohensH !== null ? reverse.outcome!.cohensH.toFixed(3) : "—"}
            </p>
            <p className="text-[11px] text-ink-400">
              95 % CI {reverse.outcome!.cohensHCI ? `${reverse.outcome!.cohensHCI.low.toFixed(3)}–${reverse.outcome!.cohensHCI.high.toFixed(3)}` : "—"} ·{" "}
              {reverse.outcome!.cohensH === null || Math.abs(reverse.outcome!.cohensH) < 0.2
                ? "ei merkittävää eroa"
                : "ero havaittu — katso otoskoko ja rajoitteet"}
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-400">
        Vertailu mittaa, käyttääkö analysoitu suomenkielinen korpus “suomalaista” kummassakin kohortissa

        Vertailtavia tekijöitä: {reverse.confounders.join(", ")}.
        Media-ilmaus on havaittu sanasto, ei näyttö puolueellisuudesta.

      </p>
    </div>
  );
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function asList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}