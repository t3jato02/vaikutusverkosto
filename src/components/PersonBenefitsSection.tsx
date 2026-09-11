// Person profile: documented awards & benefits (section 25).
// Renders only when published, source-backed data exists. An empty section
// shows clear absence-of-known-data — never a claim that no such relationship
// exists.

import Link from "next/link";
import { getEntityBenefits, type BenefitRow } from "@/lib/mediaQueries";
import { benefitEventTypeLabel, valuePrecisionLabel, selectionRoleLabel } from "@/lib/benefits";
import { entityUrlFor } from "@/lib/queries";
import { formatEur } from "@/lib/format";

function renderBenefit(b: BenefitRow, personId: string) {
  const other = b.giver ?? b.payer ?? b.recipient;
  const isAward = b.eventType === "AWARD" || b.eventType === "PRIZE" || b.eventType === "HONOUR" || b.eventType === "DECORATION";
  return (
    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] uppercase tracking-wide text-muted">{benefitEventTypeLabel(b.eventType)}</span>
        <span className="block font-medium text-ink-900">{b.title}</span>
        {other && other.id !== personId && (
          <span className="block text-xs text-muted">
            {isAward ? "Palkitsija: " : "Toinen osapuoli: "}
            <Link href={entityUrlFor(other.id, "ORGANIZATION", other.canonicalName)} className="text-accent hover:underline">
              {other.canonicalName}
            </Link>
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted">
        <span>{b.eventDate ? String(b.eventDate.getFullYear()) : ""} {selectionRoleLabel(b.selectionRole)}</span>
        {b.monetaryValue !== null && (
          <span className="tabular-nums">{formatEur(b.monetaryValue)} · {valuePrecisionLabel(b.valueType)}</span>
        )}
        {b.sourceUrl && (
          <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
        )}
      </div>
    </li>
  );
}

export default async function PersonBenefitsSection({ personEntityId }: { personEntityId: string }) {
  const benefits = await getEntityBenefits(personEntityId);
  if (benefits.length === 0) return null;

  const awards = benefits.filter((b) => b.eventType === "AWARD" || b.eventType === "PRIZE" || b.eventType === "HONOUR" || b.eventType === "DECORATION");
  const other = benefits.filter((b) => !awards.includes(b));

  return (
    <>
      {awards.length > 0 && (
        <section aria-label="Palkinnot">
          <h2 className="section-title mb-1">Palkinnot</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoidut palkinnot ja kunnianosoitukset. Palkinnon saaminen, voittajan valinta ja tuomaristossa
            toimiminen pidetään erillisinä faktoina.
          </p>
          <ul className="card divide-y divide-line">{awards.map((b) => renderBenefit(b, personEntityId))}</ul>
        </section>
      )}
      {other.length > 0 && (
        <section aria-label="Lahjat ja edut">
          <h2 className="section-title mb-1">Lahjat & edut</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoidut lahjat, edut, vieraanvaraisuus ja muut etu-tapahtumat. Arvioita ei esitetä tarkkoina summina.
          </p>
          <ul className="card divide-y divide-line">{other.map((b) => renderBenefit(b, personEntityId))}</ul>
        </section>
      )}
    </>
  );
}