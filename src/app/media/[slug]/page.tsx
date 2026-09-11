import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveEntityBySlug, entityUrlFor } from "@/lib/queries";
import { getMediaProfile } from "@/lib/mediaQueries";
import {
  editorialAffiliationLabel,
  editorialAffiliationDescription,
  mediaOutletTypeLabel,
  journalistSubtypeLabel,
  mediaSubtypeLabel,
} from "@/lib/journalism";
import { computeCoverage } from "@/lib/analysis/engine";
import { formatDate, formatDateLong } from "@/lib/format";
import { baseUrl } from "@/lib/site";
import Avatar from "@/components/Avatar";
import { ConfidenceBadge } from "@/components/badges";
import { CoveragePanel } from "@/components/journalism/Coverage";
import { IdentityFramingSummary } from "@/components/journalism/IdentityFramingSummary";
import { TrustLegend, TrustChip } from "@/components/journalism/TrustLayer";
import MediaProfileSections from "@/components/media/MediaProfileSections";
import RelationshipList from "@/components/RelationshipList";
import { toRelRows, sortRelRows } from "@/lib/relRows";
import GraphView from "@/components/GraphView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) return { title: "Mediaa ei löytynyt" };
  return {
    title: entity.canonicalName,
    description: `Mediaprofiili: ${entity.canonicalName} — omistus, toimittajat, journalistinen tuotanto ja dokumentoitu linja.`,
    openGraph: { title: entity.canonicalName, type: "website", url: `${baseUrl()}/media/${slug}` },
  };
}

export default async function MediaProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) notFound();
  if (entity.type !== "MEDIA_ORGANIZATION") redirect(entityUrlFor(entity.id, entity.type, entity.canonicalName, entity.subtype));

  const [profile, coverage] = await Promise.all([getMediaProfile(entity.id), computeCoverage("MEDIA_OUTLET", entity.id, {})]);
  const relRows = sortRelRows(toRelRows(profile.relationships, entity.id));
  const out = profile.outlet;

  return (
    <div className="space-y-8">
      <section className="card-pad flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={entity.canonicalName} type="MEDIA_ORGANIZATION" size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">
            {mediaSubtypeLabel(entity.subtype)}{out?.mediaOutletType ? ` · ${mediaOutletTypeLabel(out.mediaOutletType)}` : ""}
            {entity.countryCode ? ` · ${entity.countryCode}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-entity-title">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
            {out?.foundingYear && (
              <div><dt className="inline text-ink-300">Perustettu: </dt><dd className="inline font-medium text-ink-700">{out.foundingYear}</dd></div>
            )}
            {out?.publishLanguages?.length ? (
              <div><dt className="inline text-ink-300">Kielet: </dt><dd className="inline font-medium text-ink-700">{out.publishLanguages.map((l) => l.toUpperCase()).join(", ")}</dd></div>
            ) : null}
            {out?.fundingModel && (
              <div><dt className="inline text-ink-300">Rahoitusmalli: </dt><dd className="inline font-medium text-ink-700">{out.fundingModel}</dd></div>
            )}
            {out?.jsnMember !== undefined && (
              <div><dt className="inline text-ink-300">JSN: </dt><dd className="inline font-medium text-ink-700">{out.jsnMember ? "jäsen (itsesääntely)" : "ei dokumentoitua jäsenyyttä"}</dd></div>
            )}
            <div>
              <dt className="inline text-ink-300">Viimeksi vahvistettu: </dt>
              <dd className="inline font-medium text-ink-700">{entity.lastVerifiedAt ? formatDateLong(entity.lastVerifiedAt) : "Ei saatavilla"}</dd>
            </div>
          </dl>
          {out?.websiteUrl && (
            <a href={out.websiteUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-accent hover:underline">
              {out.websiteUrl.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="#tuotanto" className="btn-primary">Journalistinen tuotanto</Link>
            <Link href="#rahoitus" className="btn">Rahoitus</Link>
            <Link href="#johto" className="btn">Johto & hallinto</Link>
            <Link href="#lahteet" className="btn">Lähteet</Link>
            <Link href="/corrections" className="btn">Ilmoita virheestä</Link>
          </div>
        </div>
      </section>

      {/* institutionaalinen linja — ei siirretä toimittajiin */}
      {out && out.editorialAffiliationType !== "UNKNOWN" && (
        <section aria-label="Dokumentoitu institutionaalinen suhde">
          <h2 className="section-title mb-1">
            Dokumentoitu institutionaalinen suhde <TrustChip kind="verified" />
          </h2>
          <div className="card-pad">
            <p className="text-sm text-ink-800">
              {editorialAffiliationLabel(out.editorialAffiliationType)}
              {profile.party ? ` — ${profile.party.canonicalName}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink-500">{editorialAffiliationDescription(out.editorialAffiliationType)}</p>
            {out.editorialAffiliationSourceUrl && (
              <a href={out.editorialAffiliationSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent hover:underline">
                lähde ↗
              </a>
            )}
            <p className="mt-2 rounded-lg border border-dashed border-ink-300 bg-surface px-3 py-2 text-[12px] text-ink-500">
              Tämä on <strong>median institutionaalinen tausta</strong>. Sitä ei koskaan siirretä yksittäisille
              toimittajille, eikä se ole arvio median sisällöstä.
            </p>
          </div>
        </section>
      )}

      {/* omistus-/organisaatiosuhteet */}
      <section aria-label="Omistus ja organisaatiosuhteet">
        <h2 className="section-title mb-1">Omistus ja organisaatiosuhteet</h2>
        {profile.owner ? (
          <p className="card-pad text-sm text-ink-700">
            Julkinen omistaja:{" "}
            <Link href={entityUrlFor(profile.owner.id, profile.owner.type, profile.owner.canonicalName, profile.owner.subtype)} className="font-medium text-accent hover:underline">
              {profile.owner.canonicalName}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-ink-500">Ei dokumentoitua omistajasuhdetta.</p>
        )}
        <div className="mt-3">
          <GraphView entityId={entity.id} />
        </div>
        {relRows.length > 0 && <div className="mt-3"><RelationshipList rows={relRows} /></div>}
      </section>

      <TrustLegend />

      {/* toimittajat */}
      <section aria-label="Toimittajat">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Toimittajat</h2>
          <span className="meta">{profile.journalists.length} dokumentoitua tehtävää</span>
        </div>
        <ul className="card divide-y divide-ink-100">
          {profile.journalists.length === 0 && <li className="py-3 text-sm text-ink-500">Ei dokumentoituja toimittajia.</li>}
          {profile.journalists.map((j) => (
            <li key={j.id}>
              <Link href={entityUrlFor(j.personEntity.id, "PERSON", j.personEntity.canonicalName, j.personEntity.subtype)} className="flex items-center gap-3 py-2.5 hover:bg-ink-100/50">
                <Avatar name={j.personEntity.canonicalName} type="PERSON" size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{j.personEntity.canonicalName}</span>
                  <span className="block truncate text-xs text-ink-500">{j.role}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-300">{journalistSubtypeLabel(j.personEntity.subtype)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* journalistinen tuotanto */}
      <section id="tuotanto" aria-label="Journalistinen tuotanto">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Journalistinen tuotanto</h2>
          <span className="meta">{profile.articleStats} juttua korpuksessa</span>
        </div>
        <ul className="card divide-y divide-line">
          {profile.latestArticles.length === 0 && <li className="py-4 text-sm text-ink-500">Ei artikkeleita korpuksessa.</li>}
          {profile.latestArticles.map((ar) => (
            <li key={ar.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <a href={ar.canonicalUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-sm font-medium text-ink-900 hover:text-accent">
                {ar.title}
              </a>
              <span className="shrink-0 text-xs text-ink-500">{formatDate(ar.publishedAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CoveragePanel result={coverage} title="Puolueiden käsittely" kind="parties" />
        <CoveragePanel result={coverage} title="Juttutyypit (genre)" kind="genres" />
      </div>

      <IdentityFramingSummary scope="OUTLET" entityId={entity.id} entityName={entity.canonicalName} />

      {/* Julkinen media: rahoitus, rahankäyttö, johto, hallinto, palkinnot, lahjat, aikajana */}
      <MediaProfileSections entityId={entity.id} />

      {/* lähteet */}
      <section id="lahteet" aria-label="Lähteet" className="scroll-mt-20">
        <h2 className="section-title mb-2">Lähteet</h2>
        <ul className="card divide-y divide-line">
          {profile.relationships.flatMap((r) => r.evidence).length === 0 && (
            <li className="py-3 text-sm text-muted">Lähteet löytyvät kunkin suhteen ja jutun kohdalta.</li>
          )}
          {profile.relationships
            .flatMap((r) => r.evidence)
            .slice(0, 30)
            .map((ev) => (
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
        {entity.description && <p className="mt-2 text-xs text-ink-400">{entity.description}</p>}
      </section>
    </div>
  );
}