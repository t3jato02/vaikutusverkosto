// Person profile: "Syntymämaatausta ja median käyttämät määritelmät" (luvut 2, 10).
// Presents DOCUMENTED facts and the MEDIA'S WORDING side by side so the reader
// sees the difference between a fact and an editorial word choice at a glance.

import Link from "next/link";
import { getPersonIdentityFacts, getPersonMediaMentions } from "@/lib/analysis/identity/queries";
import {
  identityTermCategoryLabel,
  identityTermCategoryDescription,
  citizenshipStatusLabel,
  originFactKindLabel,
} from "@/lib/identityFraming";
import { EvidenceGradeBadge } from "@/components/journalism/EvidenceGradeBadge";
import { formatDate } from "@/lib/format";
import { entityUrlFor } from "@/lib/queries";
import { UNKNOWN_VALUE } from "@/lib/analysis/identity/safety";

export async function IdentityBackgroundSection({ personEntityId }: { personEntityId: string }) {
  const [facts, mentions] = await Promise.all([getPersonIdentityFacts(personEntityId), getPersonMediaMentions(personEntityId)]);
  const currentResidence = facts.residences.find((r) => r.isCurrent) ?? facts.residences[facts.residences.length - 1];
  const hasFacts =
    facts.birthCountry || facts.birthPlace || facts.citizenships.length > 0 || facts.residences.length > 0 || facts.selfIdentifications.length > 0;

  return (
    <section aria-label="Syntymämaatausta ja median käyttämät määritelmät">
      <h2 className="section-title mb-2">Syntymämaatausta ja median käyttämät määritelmät</h2>
      <p className="mb-3 text-xs text-ink-500">
        Syntymämaa on <strong>muuttumaton historiallinen tieto</strong>. Kansalaisuus (juridinen), asuinmaa ja
        henkilön oma identiteetti ovat <strong>erillisiä asioita</strong>. Median käyttämä ilmaus on{" "}
        <strong>toimituksellinen havainto</strong> — ei henkilön ominaisuus. Järjestelmä ei päättele tietoja
        nimestä, kielestä tai ulkonäöstä.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* DOCUMENTED FACTS */}
        <div className="card-pad">
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-900">Dokumentoidut tiedot</h3>
          {!hasFacts ? (
            <p className="text-sm text-ink-500">Ei vahvistettua julkista tietoa.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {facts.birthCountry && (
                <Row
                  label={originFactKindLabel("BIRTH_COUNTRY")}
                  value={facts.birthCountry.displayValue}
                  sourceUrl={facts.birthCountry.sourceUrl}
                  grade={facts.birthCountry.evidenceGrade}
                />
              )}
              {facts.birthPlace && (
                <Row
                  label={originFactKindLabel("BIRTH_PLACE")}
                  value={facts.birthPlace.displayValue}
                  sourceUrl={facts.birthPlace.sourceUrl}
                  grade={facts.birthPlace.evidenceGrade}
                />
              )}
              {facts.citizenships.map((c) => (
                <Row
                  key={c.id}
                  label={`${citizenshipStatusLabel(c.status)}`}
                  value={c.countryName + (c.acquiredYear ? ` (alkaen ${c.acquiredYear})` : "")}
                  sourceUrl={c.sourceUrl}
                  grade={c.evidenceGrade}
                />
              ))}
              {currentResidence && (
                <Row
                  label="Nykyinen asuinmaa"
                  value={[currentResidence.countryName, currentResidence.municipality].filter(Boolean).join(", ")}
                  sourceUrl={currentResidence.sourceUrl}
                  grade={currentResidence.evidenceGrade}
                />
              )}
              {facts.selfIdentifications.map((s) => (
                <div key={s.id} className="border-t border-ink-100 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-500">Henkilön oma identiteetti</span>
                    <EvidenceGradeBadge grade={s.evidenceGrade} size="xs" />
                  </div>
                  <blockquote className="mt-1 border-l-2 border-accent/40 pl-3 text-[13px] italic text-muted">
                    “{s.verbatimText}”
                  </blockquote>
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">
                    lähde: {s.sourceName} ↗
                  </a>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-[11px] text-ink-400">
            Nämä tiedot on tallennettu vain, kun lähde nimenomaisesti dokumentoi ne. Arvo ilman lähdettä on{" "}
            <em>“{UNKNOWN_VALUE}”</em> — ei arvaus.
          </p>
        </div>

        {/* MEDIA WORDING */}
        <div className="card-pad">
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-900">Median käyttämät kuvaukset</h3>
          {mentions.length === 0 ? (
            <p className="text-sm text-ink-500">Ei analysoituja media-ilmauksia korpuksessa.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {mentions.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 font-semibold text-ink-900">“{m.expression}”</span>
                    <span className="text-[11px] text-ink-400" title={identityTermCategoryDescription(m.termCategory)}>
                      {identityTermCategoryLabel(m.termCategory)}
                    </span>
                    {m.inHeadline && <span className="text-[10px] uppercase text-accent">otsikossa</span>}
                  </div>
                  {m.context && <p className="mt-1 text-xs italic text-muted">…{m.context}…</p>}
                  <p className="mt-1 text-[11px] text-ink-400">
                    {m.mediaOutletEntity?.canonicalName ?? ""}
                    {m.journalistEntity ? (
                      <>
                        {" · "}
                        <Link
                          href={entityUrlFor(m.journalistEntity.id, "PERSON", m.journalistEntity.canonicalName)}
                          className="text-accent hover:underline"
                        >
                          {m.journalistEntity.canonicalName}
                        </Link>
                      </>
                    ) : null}
                    {m.publishedAt ? ` · ${formatDate(m.publishedAt)}` : ""}
                  </p>
                  {m.article && (
                    <a href={m.article.canonicalUrl} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">
                      {m.article.title} ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-400">
            Ilmaukset on tallennettu sanatarkasti sellaisina kuin ne julkaisussa esiintyvät. Ne kertovat median
            sanavalinnasta, eivät henkilön kansalaisuudesta tai alkuperästä.
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, sourceUrl, grade }: { label: string; value: string; sourceUrl: string; grade: "A" | "B" | "C" | "D" | "E" }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-t border-ink-100 pt-2">
      <div>
        <span className="text-ink-500">{label}: </span>
        <span className="font-medium text-ink-900">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <EvidenceGradeBadge grade={grade} size="xs" />
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          lähde
        </a>
      </div>
    </div>
  );
}