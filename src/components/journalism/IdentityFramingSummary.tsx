// Media / journalist profile: "Kansallisuus- ja paikallisuuskehytys" (luvut 9).
// Pure data observations of the media's nationality/locality wording. Shows
// distributions + documentation rate; refuses conclusions on a small sample
// (INSUFFICIENT_SAMPLE).

import Link from "next/link";
import { computeAndStoreIdentityAggregate } from "@/lib/analysis/identity/aggregate";
import { identityTermCategoryLabel } from "@/lib/identityFraming";
import { MIN_ANALYSIS_SAMPLE } from "@/lib/analysis/identity/safety";

export async function IdentityFramingSummary({
  scope,
  entityId,
}: {
  scope: "OUTLET" | "JOURNALIST";
  entityId: string;
  entityName?: string;
}) {
  const agg = await computeAndStoreIdentityAggregate({ scope, entityId });
  const n = agg.corpus.mentionCount;
  const sufficient = n >= MIN_ANALYSIS_SAMPLE;

  return (
    <section aria-label="Kansallisuus- ja paikallisuuskehytys">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Kansallisuus- ja paikallisuuskehytys</h2>
        <Link href="/media/identity-framing" className="text-[11px] text-accent hover:underline">
          Vertaile medioita →
        </Link>
      </div>

      {n === 0 ? (
        <div className="card-pad text-sm text-ink-500">
          Ei analysoituja kansallisuus- tai paikallisuusilmauksia {scope === "OUTLET" ? "tämän median" : "tämän toimittajan"}{" "}
          korpuksessa. Ilmauksia tallennetaan luokittelijalla analysoiduista artikkeleista.{" "}
          <Link href="/methodology#identity-framing" className="text-accent hover:underline">Menetelmät →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-pad">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
              <span><strong className="text-ink-900">{agg.corpus.mentionCount}</strong> identiteettimainintaa</span>
              <span><strong className="text-ink-900">{agg.corpus.personCount}</strong> henkilöä</span>
              <span><strong className="text-ink-900">{agg.corpus.headlineCount}</strong> otsikkomainintaa</span>
              <span>
                dokumentointiaste:{" "}
                <strong className="text-ink-900">{((agg.documentation.rate ?? 0) * 100).toFixed(0)} %</strong>
                <span className="text-ink-400"> (syntymämaa dokumentoitu)</span>
              </span>
            </div>
            {!sufficient && (
              <p className="mt-2 rounded-lg border border-dashed border-ink-300 bg-surface px-3 py-2 text-[12px] text-ink-500">
                Otos on liian pieni johtopäätöksiin ({n} — vaaditaan vähintään {MIN_ANALYSIS_SAMPLE}). Näytetään vain havainnot.
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BarCard title="Yleisimmät ilmaukset" note="media käyttämä sanavalinta, sanatarkka">
              {agg.terms.slice(0, 10).map((t) => {
                const max = agg.terms[0]?.count ?? 1;
                return (
                  <BarRow key={t.expression} label={`“${t.expression}”`} count={t.count} sub={identityTermCategoryLabel(t.category)} max={max} />
                );
              })}
            </BarCard>

            <BarCard title="Käytetty ilmaus vs. dokumentoitu syntymämaa" note="ristiintaulukointi (vain dokumentoidut)">
              {agg.birthCountryCross.slice(0, 10).map((c) => {
                const max = Math.max(...agg.birthCountryCross.map((x) => x.total), 1);
                return (
                  <div key={c.expression} className="py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-ink-700">“{c.expression}”</span>
                      <span className="shrink-0 tabular-nums text-ink-400">{c.total}</span>
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-ink-100">
                      <div className="bg-accent" style={{ width: `${(c.birthCountryFI / max) * 100}%` }} title={`Syntymämaa Suomi: ${c.birthCountryFI}`} />
                      <div className="bg-stale" style={{ width: `${(c.birthCountryForeign / max) * 100}%` }} title={`Syntymämaa ulkomailla: ${c.birthCountryForeign}`} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-400">
                      {c.birthCountryFI} × syntymämaa Suomi · {c.birthCountryForeign} × syntymämaa ulkomailla · {c.unknownBirth} tuntematon
                    </div>
                  </div>
                );
              })}
            </BarCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BarCard title="Käytetty ilmaus vs. kansalaisuus" note="juridinen status, dokumentoitu">
              {agg.citizenshipCross.slice(0, 8).map((c) => (
                <div key={c.expression} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="truncate text-ink-700">“{c.expression}”</span>
                  <span className="shrink-0 tabular-nums text-ink-400">
                    {c.withFICitizenship} × Suomen kansalainen · {c.withForeignCitizenship} × ulkomainen
                  </span>
                </div>
              ))}
            </BarCard>

            <BarCard title="Paikallisuusilmaukset" note="kaupunkitason nimitykset">
              {agg.cityTerms.length === 0 ? (
                <p className="py-2 text-xs text-ink-400">Ei kaupunki-identiteettiilmauksia.</p>
              ) : (
                agg.cityTerms.slice(0, 8).map((c) => {
                  const max = agg.cityTerms[0]?.count ?? 1;
                  return <BarRow key={c.expression} label={`“${c.expression}”`} count={c.count} sub="paikallisuus" max={max} />;
                })
              )}
            </BarCard>
          </div>

          <p className="text-[11px] text-ink-400">
            Analyysi perustuu luokiteltuihin identiteettimainintoihin ({agg.algorithmVersion}) ja dokumentoituihin
            henkilötietoihin. Ristiintaulukointi ei ole näyttö puolueellisuudesta — se kuvaa käytettyä sanastoa.
            Media-ilmaus säilyy sanatarkasti; puuttuva tieto on “Ei vahvistettua tietoa”, ei arvaus.
          </p>
        </div>
      )}
    </section>
  );
}

function BarCard({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="card-pad">
      <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-900">{title}</h3>
      <p className="mb-2 text-[11px] text-ink-400">{note}</p>
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  );
}

function BarRow({ label, count, sub, max }: { label: string; count: number; sub: string; max: number }) {
  return (
    <div className="py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-ink-700">{label}</span>
        <span className="shrink-0 tabular-nums text-ink-400">
          {count} <span className="text-ink-300">· {sub}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-100">
        <div className="h-full bg-accent" style={{ width: `${(count / max) * 100}%` }} />
      </div>
    </div>
  );
}