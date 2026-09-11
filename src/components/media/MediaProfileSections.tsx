// Public media profile sections (Rahoitus, Rahankäyttö, Johto, Hallinto,
// Palkinnot, Lahjat & edut, Aikajana). Generic for any media organisation;
// sections render only when source-backed data exists. Empty sections are
// shown as a clear absence-of-known-data note — never as a claim that no such
// relationship exists (section 25).

import Link from "next/link";
import { getMediaFinance, getMediaGovernance, getEntityBenefits, getMediaTimeline, type BenefitRow } from "@/lib/mediaQueries";
import {
  benefitEventTypeLabel,
  valuePrecisionLabel,
  selectionRoleLabel,
} from "@/lib/benefits";
import { statementCategoryLabel } from "@/lib/financial";
import { entityUrlFor } from "@/lib/queries";
import { formatEur } from "@/lib/format";

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}

function yearRange(start: Date | null, end: Date | null): string {
  const s = start ? String(start.getFullYear()) : "?";
  const e = end ? String(end.getFullYear()) : "—";
  return `${s}–${e}`;
}

function benefitOtherParty(b: BenefitRow, entityId: string): { id: string; name: string } | null {
  for (const p of [b.recipient, b.giver, b.payer]) {
    if (p && p.id !== entityId) return { id: p.id, name: p.canonicalName };
  }
  return null;
}

export default async function MediaProfileSections({ entityId }: { entityId: string }) {
  const finance = await getMediaFinance(entityId);
  const governance = await getMediaGovernance(entityId);
  const benefits = await getEntityBenefits(entityId);
  const timeline = await getMediaTimeline(entityId, finance);

  const awards = benefits.filter((b) => b.eventType === "AWARD" || b.eventType === "PRIZE" || b.eventType === "HONOUR" || b.eventType === "DECORATION");
  const otherBenefits = benefits.filter((b) => !awards.includes(b));
  const currentRoles = governance.positions.filter((p) => p.isCurrent);
  const historicalRoles = governance.positions.filter((p) => !p.isCurrent);

  const anchors = [
    finance.length > 0 ? { id: "rahoitus", label: "Rahoitus" } : null,
    finance.length > 0 ? { id: "rahankaytto", label: "Rahankäyttö" } : null,
    governance.positions.length > 0 ? { id: "johto", label: "Johto" } : null,
    (governance.council || governance.positions.length > 0) ? { id: "hallinto", label: "Hallinto" } : null,
    awards.length > 0 ? { id: "palkinnot", label: "Palkinnot" } : null,
    otherBenefits.length > 0 ? { id: "lahjat", label: "Lahjat & edut" } : null,
    timeline.length > 0 ? { id: "aikajana", label: "Aikajana" } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <>
      {anchors.length > 0 && (
        <nav aria-label="Sivun osiot" className="sticky top-14 z-10 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface/95 px-2 py-1.5 text-[12px]">
          {anchors.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="rounded px-2 py-0.5 text-accent hover:bg-ink-100">
              {a.label}
            </a>
          ))}
        </nav>
      )}

      {/* ------------------------------------------------ Rahoitus */}
      {finance.length > 0 && (
        <section id="rahoitus" aria-label="Rahoitus" className="scroll-mt-24">
          <h2 className="section-title mb-1">Rahoitus</h2>
          <p className="mb-2 text-xs text-muted">
            Vuosittaiset tuotot organisaation tilinpäätöksen mukaisesti. Eri tulolajeja ei lasketa yhteen
            selittämättä laskentatapaa; kokonaissumma on lähteen ilmoittama.
          </p>
          {finance.map((y) => {
            const total = y.income.find((i) => i.isTotal);
            const categories = y.income.filter((i) => !i.isTotal);
            const max = Math.max(...categories.map((c) => c.amount), 0);
            return (
              <div key={y.year} className="card-pad">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold tabular-nums">{y.year}</h3>
                  {total && <span className="text-sm tabular-nums font-semibold">{formatEur(total.amount)}</span>}
                </div>
                {categories.length === 0 && total && (
                  <p className="mt-1 text-xs text-muted">{total.note}</p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {categories.map((c) => (
                    <li key={c.category} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-[12px] text-ink-700">{statementCategoryLabel(c.category, c.categoryLabel)}</span>
                      <span className="h-2 flex-1 rounded bg-ink-100" aria-hidden>
                        <span className="block h-2 rounded bg-accent/70" style={{ width: `${pct(c.amount, max)}%` }} />
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-700">{formatEur(c.amount)}</span>
                    </li>
                  ))}
                </ul>
                <a href={total?.reportUrl ?? categories[0]?.reportUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent hover:underline">
                  lähde ↗
                </a>
                <span className="ml-1 text-[11px] text-muted">· {valuePrecisionLabel(total?.valueType ?? categories[0]?.valueType)}</span>
              </div>
            );
          })}
          <p className="mt-1 text-[11px] text-muted">
            Rahoituskoostumus perustuu tilinpäätöksiin; valtion rahoituksen Yle-veropohja ja muut tuotot on
            eroteltu toisistaan, eikä arvioita esitetä tarkkoina summina.
          </p>
        </section>
      )}

      {/* ------------------------------------------------ Rahankäyttö */}
      {finance.length > 0 && (
        <section id="rahankaytto" aria-label="Rahankäyttö" className="scroll-mt-24">
          <h2 className="section-title mb-2">Rahankäyttö</h2>
          {finance.map((y) => {
            const total = y.expenditure.find((i) => i.isTotal);
            const categories = y.expenditure.filter((i) => !i.isTotal);
            const max = Math.max(...categories.map((c) => c.amount), 0);
            if (categories.length === 0 && !total) return null;
            return (
              <div key={`ex-${y.year}`} className="card-pad">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold tabular-nums">{y.year}</h3>
                  {total && <span className="text-sm tabular-nums font-semibold">{formatEur(total.amount)}</span>}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {categories.map((c) => (
                    <li key={c.category} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-[12px] text-ink-700">{statementCategoryLabel(c.category, c.categoryLabel)}</span>
                      <span className="h-2 flex-1 rounded bg-ink-100" aria-hidden>
                        <span className="block h-2 rounded bg-ink-500" style={{ width: `${pct(c.amount, max)}%` }} />
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-700">{formatEur(c.amount)}</span>
                    </li>
                  ))}
                </ul>
                {total?.note && <p className="mt-1 text-[11px] text-muted">{total.note}</p>}
                <a href={total?.reportUrl ?? categories[0]?.reportUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent hover:underline">
                  lähde ↗
                </a>
              </div>
            );
          })}
        </section>
      )}

      {/* ------------------------------------------------ Johto */}
      {governance.positions.length > 0 && (
        <section id="johto" aria-label="Johto" className="scroll-mt-24">
          <h2 className="section-title mb-1">Johto</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoidut johto- ja luottamustehtävät. Tehtävän ajallinen voimassaolo näytetään sellaisena kuin
            lähde sen ilmoittaa; historialliset tehtävät eivät näy nykyisinä.
          </p>
          {currentRoles.length > 0 && (
            <ul className="card divide-y divide-line">
              {currentRoles.map((p) => (
                <li key={`c-${p.personId}-${p.role}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={entityUrlFor(p.personId, p.type, p.name)} className="font-medium text-accent hover:underline">
                    {p.name}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.role}</span>
                  <span className="shrink-0 text-[11px] text-muted">{yearRange(p.startDate, p.endDate)}</span>
                </li>
              ))}
            </ul>
          )}
          {historicalRoles.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-accent">
                Aiemmat dokumentoidut tehtävät ({historicalRoles.length})
              </summary>
              <ul className="card divide-y divide-line">
                {historicalRoles.map((p) => (
                  <li key={`h-${p.personId}-${p.role}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={entityUrlFor(p.personId, p.type, p.name)} className="font-medium text-accent hover:underline">
                      {p.name}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.role}</span>
                    <span className="shrink-0 text-[11px] text-muted">{yearRange(p.startDate, p.endDate)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* ------------------------------------------------ Hallinto */}
      {(governance.council || governance.positions.length > 0) && (
        <section id="hallinto" aria-label="Hallinto" className="scroll-mt-24">
          <h2 className="section-title mb-2">Hallinto</h2>
          {governance.council && (
            <div className="card-pad">
              <h3 className="text-sm font-semibold">{governance.council.name}</h3>
              <p className="text-xs text-muted">
                {governance.council.role ?? "Valvova toimielin"} · {governance.council.members.length} dokumentoitua jäsentä
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px]">
                {governance.council.members.map((m) => (
                  <li key={m.personId} className="flex items-baseline justify-between gap-2">
                    <Link href={entityUrlFor(m.personId, "PERSON", m.name)} className="text-accent hover:underline">{m.name}</Link>
                    <span className="text-[11px] text-muted">{m.role}</span>
                  </li>
                ))}
              </ul>
              {governance.council.sourceUrl && (
                <a href={governance.council.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent hover:underline">
                  lähde ↗
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------ Palkinnot */}
      {awards.length > 0 && (
        <section id="palkinnot" aria-label="Palkinnot" className="scroll-mt-24">
          <h2 className="section-title mb-1">Palkinnot</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoidut palkinnot ja kunnianosoitukset. Palkinnon saaminen, voittajan valinta ja tuomaristossa
            toimiminen pidetään erillisinä faktoina.
          </p>
          <ul className="card divide-y divide-line">
            {awards.map((b) => {
              const other = benefitOtherParty(b, entityId);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-ink-900">{b.title}</span>
                    {other && (
                      <span className="text-xs text-muted"> — {other.name}</span>
                    )}
                    {b.description && <span className="block truncate text-[11px] text-muted">{b.description}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted">
                    <span>{b.eventDate ? String(b.eventDate.getFullYear()) : ""} {selectionRoleLabel(b.selectionRole)}</span>
                    {b.monetaryValue !== null && (
                      <span className="tabular-nums">{formatEur(b.monetaryValue)} {valuePrecisionLabel(b.valueType)}</span>
                    )}
                    {b.sourceUrl && (
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ Lahjat & edut */}
      {otherBenefits.length > 0 && (
        <section id="lahjat" aria-label="Lahjat ja edut" className="scroll-mt-24">
          <h2 className="section-title mb-1">Lahjat & edut</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoidut lahjat, edut, vieraanvaraisuus ja muut etu-tapahtumat. Arvioita ei esitetä tarkkoina summina.
          </p>
          <ul className="card divide-y divide-line">
            {otherBenefits.map((b) => {
              const other = benefitOtherParty(b, entityId);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted">{benefitEventTypeLabel(b.eventType)}</span>
                    <span className="block font-medium text-ink-900">{b.title}</span>
                    {other && <span className="block text-xs text-muted">Toinen osapuoli: {other.name}</span>}
                    {b.description && <span className="block truncate text-[11px] text-muted">{b.description}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted">
                    <span>{b.eventDate ? String(b.eventDate.getFullYear()) : ""}</span>
                    {b.monetaryValue !== null && (
                      <span className="tabular-nums">{formatEur(b.monetaryValue)} {valuePrecisionLabel(b.valueType)}</span>
                    )}
                    {b.sourceUrl && (
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ Aikajana */}
      {timeline.length > 0 && (
        <section id="aikajana" aria-label="Aikajana" className="scroll-mt-24">
          <h2 className="section-title mb-2">Aikajana</h2>
          <ol className="space-y-1.5 border-l border-line pl-4">
            {timeline.map((e, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 w-20 tabular-nums text-[11px] text-muted">{e.date ? String(e.date.getFullYear()) : "—"}</span>
                <span className="font-medium text-ink-800">{e.label}</span>
                {e.detail && <span className="truncate text-[11px] text-muted">· {e.detail}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}