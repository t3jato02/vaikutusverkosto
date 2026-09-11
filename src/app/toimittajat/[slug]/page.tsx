import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveEntityBySlug, entityUrlFor } from "@/lib/queries";
import { getJournalistProfile } from "@/lib/mediaQueries";
import { isJournalistSubtype, journalistCaption, personalFactLabel, affiliationTypeLabel } from "@/lib/journalism";
import { computeCoverage } from "@/lib/analysis/engine";
import { toRelRows, sortRelRows } from "@/lib/relRows";
import { formatDateLong, formatDate } from "@/lib/format";
import { baseUrl } from "@/lib/site";
import Avatar from "@/components/Avatar";
import { ConfidenceBadge, VerificationBadge, TemporalBadge } from "@/components/badges";
import { EvidenceGradeBadge } from "@/components/journalism/EvidenceGradeBadge";
import { TrustLegend, TrustChip } from "@/components/journalism/TrustLayer";
import { CoveragePanel } from "@/components/journalism/Coverage";
import { IdentityFramingSummary } from "@/components/journalism/IdentityFramingSummary";
import PersonBenefitsSection from "@/components/PersonBenefitsSection";
import RelationshipList from "@/components/RelationshipList";
import GraphView from "@/components/GraphView";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) return { title: "Toimittajaa ei löytynyt" };
  return {
    title: entity.canonicalName,
    description: `Profiili: ${entity.canonicalName} — dokumentoitu työhistoria, journalistinen tuotanto, aihealueet ja lähteet.`,
    openGraph: { title: entity.canonicalName, type: "profile", url: `${baseUrl()}/toimittajat/${slug}` },
  };
}

export default async function JournalistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity || entity.type !== "PERSON") notFound();
  if (!isJournalistSubtype(entity.subtype)) redirect(entityUrlFor(entity.id, entity.type, entity.canonicalName, entity.subtype));

  const profile = await getJournalistProfile(entity.id);
  const currentPos = profile.currentPosition;
  const coverage = await computeCoverage("JOURNALIST", entity.id, {});

  const relRows = sortRelRows(toRelRows(profile.relationships, entity.id));

  // Ownership chain of the current employer (up to 3 hops).
  const chain: { name: string; href: string; type: string; relationshipType: string | null }[] = [];
  if (currentPos?.organizationEntityId) {
    let curId: string | null = currentPos.organizationEntityId;
    const seen = new Set<string>();
    for (let hop = 0; hop < 3 && curId; hop++) {
      const e = (await db.entity.findUnique({
        where: { id: curId },
        select: { id: true, canonicalName: true, type: true, subtype: true },
      })) as { id: string; canonicalName: string; type: string; subtype: string | null } | null;
      if (!e) break;
      chain.push({
        name: e.canonicalName,
        href: entityUrlFor(e.id, e.type as never, e.canonicalName, e.subtype),
        type: e.type,
        relationshipType: hop === 0 ? "WORKS_FOR" : ("OWNED_BY" as const),
      });
      if (seen.has(e.id)) break;
      seen.add(e.id);
      const owner = (await db.relationship.findFirst({
        where: { sourceEntityId: e.id, relationshipType: "OWNED_BY", verificationStatus: { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] } },
        select: { targetEntityId: true },
      })) as { targetEntityId: string } | null;
      curId = owner?.targetEntityId ?? null;
      if (curId === e.id) curId = null;
    }
  }

  const timeline = [
    ...profile.positions.map((p) => ({
      date: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      category: "employment" as const,
      label: `${p.role} — ${p.organizationEntity?.canonicalName ?? "organisaatio"}${p.endDate ? ` (${formatDate(p.startDate)} – ${formatDate(p.endDate)})` : p.isCurrent ? " (nykyinen)" : ""}`,
      sourceUrl: p.source?.sourceUrl,
    })),
    ...profile.affiliations.map((a) => ({
      date: a.startYear ? `${a.startYear}-01-01` : a.publicationDate ? a.publicationDate.toISOString().slice(0, 10) : null,
      category: "election" as const,
      label: `${affiliationTypeLabel(a.affiliationType)}${a.role ? ` — ${a.role}` : ""}${a.partyEntity ? ` (${a.partyEntity.canonicalName})` : ""}`,
      sourceUrl: a.sourceUrl,
    })),
  ]
    .filter((t) => t.date)
    .sort((a, b) => a.date!.localeCompare(b.date!));

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="card-pad flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={entity.canonicalName} type="PERSON" imageUrl={entity.person?.imageUrl ?? null} size={88} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">
            TOIMITTAJA
            {currentPos?.organizationEntity ? ` · ${currentPos.organizationEntity.canonicalName}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-entity-title">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {journalistCaption(entity.subtype, currentPos?.organizationEntity?.canonicalName)}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
            <div>
              <dt className="inline text-ink-300">Artikkeleita korpuksessa: </dt>
              <dd className="inline font-medium text-ink-700">{coverage.corpusSize}</dd>
            </div>
            <div>
              <dt className="inline text-ink-300">Erikoisalat: </dt>
              <dd className="inline font-medium text-ink-700">
                {entity.person?.specialties?.length ? entity.person.specialties.join(", ") : "Ei vahvistettua julkista tietoa"}
              </dd>
            </div>
            <div>
              <dt className="inline text-ink-300">Aihealueet: </dt>
              <dd className="inline font-medium text-ink-700">
                {entity.person?.topicAreas?.length ? entity.person.topicAreas.join(", ") : "Ei vahvistettua julkista tietoa"}
              </dd>
            </div>
            <div>
              <dt className="inline text-ink-300">Viimeksi vahvistettu: </dt>
              <dd className="inline font-medium text-ink-700">{entity.lastVerifiedAt ? formatDateLong(entity.lastVerifiedAt) : "Ei saatavilla"}</dd>
            </div>
          </dl>
          {entity.person?.bioUrl && (
            <a href={entity.person.bioUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-accent hover:underline">
              Julkinen kirjoittajaprofiili ↗
            </a>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="#tuotanto" className="btn-primary">Journalistinen tuotanto</Link>
            <Link href="#lahteet" className="btn">Lähteet</Link>
            <Link href="/corrections" className="btn">Ilmoita virheestä</Link>
          </div>
        </div>
      </section>

      {/* tiedot: faktat vs analyysi */}
      <section aria-label="Tietotyypit">
        <ChooseFactOrAnalysisRow />
      </section>

      <TrustLegend />

      {/* yhteenveto */}
      {entity.description && (
        <section aria-label="Yhteenveto">
          <h2 className="section-title mb-2">Yhteenveto</h2>
          <p className="card-pad text-sm leading-relaxed text-ink-700">{entity.description}</p>
        </section>
      )}

      {/* työhistoria */}
      <section id="tyohistoria" aria-label="Työhistoria">
        <h2 className="section-title mb-2">Työhistoria</h2>
        <ul className="card divide-y divide-line">
          {profile.positions.length === 0 && <li className="py-3 text-sm text-ink-500">Ei dokumentoituja tehtäviä.</li>}
          {profile.positions.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.isCurrent ? "bg-emerald-500" : "bg-ink-300"}`} />
                <span className="text-sm font-medium text-ink-900">{p.role}</span>
                {p.organizationEntity && (
                  <Link href={entityUrlFor(p.organizationEntity.id, p.organizationEntity.type, p.organizationEntity.canonicalName, p.organizationEntity.subtype)} className="text-sm text-accent hover:underline">
                    {p.organizationEntity.canonicalName}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <span>{formatDate(p.startDate)} — {p.isCurrent ? "nykyhetki" : formatDate(p.endDate)}</span>
                {p.source && (
                  <a href={p.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* hyvinvointi/faktat tehtävämuutokset ja elämänpolku */}
      {profile.personalFacts.length > 0 && (
        <section aria-label="Taustatiedot">
          <h2 className="section-title mb-2">
            Taustatiedot <TrustChip kind="verified" />
          </h2>
          <ul className="card divide-y divide-line">
            {profile.personalFacts.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-ink-500">{personalFactLabel(f.factType)}</span>
                  <span className="font-medium text-ink-900">{f.value}</span>
                  {f.proficiency && <span className="text-xs text-muted">({f.proficiency})</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {f.publicationDate && <span className="text-muted">{formatDate(f.publicationDate)}</span>}
                  <EvidenceGradeBadge grade={f.evidenceGrade} size="xs" />
                  <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ink-300">
            Nämä tiedot on tallennettu vain, kun lähde nimenomaisesti dokumentoi ne. Ilman lähdettä arvo on
            “Ei vahvistettua julkista tietoa” — ei arvaus.
          </p>
        </section>
      )}

      {/* julkisesti vahvistetut sidokset (poliittiset) */}
      <section aria-label="Julkisesti vahvistetut sidokset">
        <h2 className="section-title mb-1">Julkisesti vahvistetut sidokset</h2>
        <p className="mb-2 text-xs text-ink-500">
          Vain henkilön itsensä tai luotettavan lähteen nimenomaan dokumentoimat puoluesidokset (osio 3). Nämä
          erotetaan selvästi sisältöanalyysista.
        </p>
        {profile.affiliations.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-4 text-sm text-muted">
            Ei vahvistettua julkista tietoa.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {profile.affiliations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{affiliationTypeLabel(a.affiliationType)}</span>{" "}
                  <span className="font-medium text-ink-900">{a.role ?? a.description}</span>
                  {a.partyEntity && <span className="text-muted"> · {a.partyEntity.canonicalName}</span>}
                  {a.verbatimText && <blockquote className="mt-1 border-l-2 border-accent/40 pl-3 text-[13px] italic text-muted">“{a.verbatimText}”</blockquote>}
                  <p className="mt-0.5 text-xs text-ink-400">
                    {a.startYear ?? "?"}–{a.endYear ?? (a.isCurrent ? "nykyhetki" : "?")}
                    {" · "}lähde: <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{a.sourceName}</a>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <EvidenceGradeBadge grade={a.evidenceGrade} size="xs" />
                  <VerificationBadge status={a.verificationStatus} variant="dot" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* journalistinen tuotanto */}
      <section id="tuotanto" aria-label="Journalistinen tuotanto">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Journalistinen tuotanto</h2>
          <span className="meta">{profile.articles.length} juttua korpuksessa</span>
        </div>
        <ul className="card divide-y divide-line">
          {profile.articles.length === 0 && <li className="py-4 text-sm text-ink-500">Ei artikkeleita korpuksessa.</li>}
          {profile.articles.map((ar) => (
            <li key={ar.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <a href={ar.canonicalUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-sm font-medium text-ink-900 hover:text-accent">
                {ar.title}
              </a>
              <div className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                <span>{ar.publisherEntity?.canonicalName ?? ""}</span>
                <span>{formatDate(ar.publishedAt)}</span>
                <TemporalBadge state="CURRENT" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* puolueiden käsittely + poliittiset henkilöt + jakaumat */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CoveragePanel result={coverage} title="Puolueiden käsittely" kind="parties" />
        <CoveragePanel result={coverage} title="Käsitellyt poliitikot ja puolueet" kind="politicians" />
        <CoveragePanel result={coverage} title="Juttutyypit (genre)" kind="genres" />
        <CoveragePanel result={coverage} title="Aihealueet" kind="topics" />
      </div>
      {coverage.framing && (
        <section aria-label="Kehystysjakauma">
          <h2 className="section-title mb-2">Kehystysjakauma (automaattinen arvio)</h2>
          <div className="card-pad">
            <CoveragePanel result={coverage} title="Politiikka-aiheinen aineisto" kind="framing" />
            <p className="mt-2 text-[11px] text-ink-400">
              {coverage.framing.limitation} Ei muunneta kannaksi, ei näytetä “toimittaja on X”.
            </p>
          </div>
        </section>
      )}

      <IdentityFramingSummary scope="JOURNALIST" entityId={entity.id} entityName={entity.canonicalName} />

      <PersonBenefitsSection personEntityId={entity.id} />

      {/* verkosto */}
      <section aria-label="Verkosto ja organisatoriset yhteydet">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Verkosto</h2>
          <span className="meta">{relRows.length} dokumentoitua yhteyttä</span>
        </div>
        <GraphView entityId={entity.id} />
        <div className="mt-3">
          <RelationshipList rows={relRows} emptyText="Ei dokumentoituja verkostoyhteyksiä." />
        </div>
      </section>

      {/* mediaomistusverkosto */}
      {chain.length > 0 && (
        <section aria-label="Mediaomistusverkosto">
          <h2 className="section-title mb-2">Mediaomistusverkosto</h2>
          <div className="card-pad flex flex-wrap items-center gap-2 text-sm">
            {chain.map((c, i) => (
              <span key={c.href} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink-300">{c.relationshipType === "OWNED_BY" ? "→ omistaa" : "→"}</span>}
                <Link href={c.href} className="font-medium text-accent hover:underline">{c.name}</Link>
              </span>
            ))}
            <span className="ml-2 text-[11px] text-ink-300">(julkinen omistusketju, lähdeperusteinen)</span>
          </div>
        </section>
      )}

      {/* aikajana */}
      {timeline.length > 0 && (
        <section aria-label="Aikajana">
          <h2 className="section-title mb-2">Aikajana</h2>
          <ol className="card divide-y divide-line">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted">{t.date?.slice(0, 4)}</span>
                <span className="text-ink-800">{t.label}</span>
                {t.sourceUrl && (
                  <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-xs text-accent hover:underline">lähde</a>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* lähteet */}
      <section id="lahteet" aria-label="Lähteet" className="scroll-mt-20">
        <h2 className="section-title mb-2">Lähteet</h2>
        <ul className="card divide-y divide-line">
          {profile.evidence.length === 0 && (
            <li className="py-3 text-sm text-muted">Ei erillisiä lähdeviittauksia; jokaisella yhteydellä ja jutulla on oma lähteensä.</li>
          )}
          {profile.evidence.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <a href={ev.source.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {ev.source.sourceName}
              </a>
              <span className="shrink-0 text-ink-300">
                {ev.source.publicationDate ? formatDate(ev.source.publicationDate) : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* korjaukset */}
      <section aria-label="Korjaukset ja päivityshistoria">
        <h2 className="section-title mb-2">Korjaukset ja päivityshistoria</h2>
        <p className="card-pad text-sm text-ink-500">
          Oletko huomannut virheen? <Link href="/corrections" className="text-accent hover:underline">Ilmoita virheestä</Link>.
          Kaikki korjaukset käsitellään ihmisen tekeminä ja ne jäävät toimenpidehistoriaan.
        </p>
      </section>
    </div>
  );
}

function ChooseFactOrAnalysisRow() {
  return (
    <div className="grid gap-2 text-[12px] text-muted sm:grid-cols-3">
      <div className="rounded-lg border border-verified/25 bg-verified-soft px-3 py-2">
        <span className="font-semibold text-verified">✓ Vahvistettu fakta</span> — lähde osoittaa asian suoraan.
      </div>
      <div className="rounded-lg border border-stale/25 bg-stale-soft px-3 py-2">
        <span className="font-semibold text-stale">◐ Data-analyysi</span> — sovellus laskee tuloksen julkisesta aineistosta.
      </div>
      <div className="rounded-lg border border-line bg-surface px-3 py-2">
        <span className="font-semibold text-ink-500">? Tulkinta / epävarma</span> — ei esitetä faktana.
      </div>
    </div>
  );
}