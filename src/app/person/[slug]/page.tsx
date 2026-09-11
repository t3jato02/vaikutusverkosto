import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveEntityBySlug, getPersonProfile, entityUrlFor } from "@/lib/queries";
import { isJournalistSubtype } from "@/lib/journalism";
import { baseUrl } from "@/lib/site";
import { TIERS } from "@/lib/constants";
import { formatDate, formatDateLong, formatEur } from "@/lib/format";
import { toRelRows, sortRelRows } from "@/lib/relRows";
import RelationshipList from "@/components/RelationshipList";
import {
  institutionalPower,
  networkCentrality,
  boardReach,
  appointmentReach,
  financialNetwork,
  dataConfidence,
  computeTier,
  type PersonMetricInput,
  type RelationshipInput,
} from "@/lib/metrics";
import Avatar from "@/components/Avatar";
import PoliticianMediaCoverage from "@/components/journalism/PoliticianMediaCoverage";
import { IdentityBackgroundSection } from "@/components/journalism/IdentityBackgroundSection";
import PersonBenefitsSection from "@/components/PersonBenefitsSection";
import { ConfidenceBadge } from "@/components/badges";
import { sourceTypeLabel } from "@/components/SourceLink";
import GraphView from "@/components/LazyGraphView";
import EntityNetworkPosition from "@/components/EntityNetworkPosition";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) return { title: "Henkilöä ei löytynyt" };
  return {
    title: entity.canonicalName,
    description: `Profiili: ${entity.canonicalName} — dokumentoidut tehtävät, verkostot, rahavirrat ja lähteet.`,
    openGraph: { title: entity.canonicalName, type: "profile", url: `${baseUrl()}/person/${slug}` },
  };
}


export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity || entity.type !== "PERSON") notFound();
  // Journalists have a dedicated, richer canonical profile route.
  if (isJournalistSubtype(entity.subtype)) {
    redirect(entityUrlFor(entity.id, entity.type, entity.canonicalName, entity.subtype));
  }

  const profile = await getPersonProfile(entity.id);

  const relInputs: RelationshipInput[] = profile.relationships.map((r) => ({
    type: r.relationshipType as never,
    confidence: r.confidence,
    startDate: r.startDate,
    endDate: r.endDate,
    amount: r.amount ? { value: Number(r.amount) } : null,
  }));
  const metricInput: PersonMetricInput = {
    positions: profile.positions.map((p) => ({
      role: p.role,
      isCurrent: p.isCurrent,
      orgType: p.organizationEntity?.type ?? undefined,
    })),
    relationships: relInputs,
    incomingFlows: profile.flows
      .filter((f) => f.recipientEntityId === entity.id)
      .map((f) => ({ amount: Number(f.amount), confidence: f.confidence, flowType: f.flowType })),
    outgoingFlows: profile.flows
      .filter((f) => f.payerEntityId === entity.id)
      .map((f) => ({ amount: Number(f.amount), confidence: f.confidence, flowType: f.flowType })),
    sources: entity.sourceCount ?? 0,
  };

  const ip = institutionalPower(metricInput);
  const bc = networkCentrality(relInputs, 400);
  const br = boardReach(metricInput);
  const ar = appointmentReach(metricInput);
  const fn = financialNetwork(metricInput);
  const dc = dataConfidence(metricInput);
  const tier = computeTier({
    positions: metricInput.positions,
    relationships: relInputs,
    municipal: !!entity.municipality,
    national: true,
  });

  const currentPositions = profile.positions.filter((p) => p.isCurrent);
  const orgRelRows = sortRelRows(
    toRelRows(
      profile.relationships.filter(
        (r) => (r.sourceEntityId === entity.id ? r.targetEntity : r.sourceEntity).type !== "POLITICAL_PARTY",
      ),
      entity.id,
    ),
  );

  return (
    <div className="space-y-8">
      {/* entity hero */}
      <section className="card-pad flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar
          name={entity.canonicalName}
          type="PERSON"
          imageUrl={entity.person?.imageUrl ?? null}
          size={88}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">
            Henkilö{entity.person?.electoralDistrict ? ` · ${entity.person.electoralDistrict}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-entity-title">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
          </div>
          {entity.person?.profession && (
            <p className="mt-1 text-sm text-muted">{entity.person.profession}</p>
          )}
          {currentPositions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-700">
              {currentPositions.slice(0, 3).map((p) => (
                <span key={p.id} className="flex items-center gap-1">
                  <span className="font-medium">{p.role}</span>
                  {p.organizationEntity && (
                    <Link href={entityUrlFor(p.organizationEntity.id, p.organizationEntity.type, p.organizationEntity.canonicalName)} className="text-accent hover:underline">
                      {p.organizationEntity.canonicalName}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
            <div>
              <dt className="inline text-ink-300">Yhteyksiä: </dt>
              <dd className="inline font-medium text-ink-700">{orgRelRows.length}</dd>
            </div>
            <div>
              <dt className="inline text-ink-300">Lähteitä: </dt>
              <dd className="inline font-medium text-ink-700">{entity.sourceCount}</dd>
            </div>
            {entity.municipality && (
              <div>
                <dt className="inline text-ink-300">Kotikunta: </dt>
                <dd className="inline font-medium text-ink-700">{entity.municipality}</dd>
              </div>
            )}
            <div>
              <dt className="inline text-ink-300">Viimeksi vahvistettu: </dt>
              <dd className="inline font-medium text-ink-700">
                {entity.lastVerifiedAt ? formatDateLong(entity.lastVerifiedAt) : "Ei saatavilla"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="#lahteet" className="btn-primary">Näytä lähteet</Link>
            <Link href="/corrections" className="btn">Ilmoita virheestä</Link>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <span className="label">Vallan taso (johdettu)</span>
          <span className="text-sm font-semibold text-ink" title="Algoritmilla johdettu rakenteellinen ulottuvuus, ei moraaliarvio">
            Taso {tier} — {TIERS[tier - 1]?.fi}
          </span>
          <Link href="/methodology#tiers" className="text-[11px] text-accent hover:underline">
            Miten taso lasketaan →
          </Link>
        </div>
      </section>

      {/* metrics */}
      <section aria-label="Mittarit">
        <h2 className="section-title mb-2">Mittarit <span className="text-xs font-normal text-ink-300">(johdettuja, ei tuomioita)</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Institutionaalinen valta" value={String(ip.value)} title={ip.interpretation} />
          <MetricCard label="Verkostokeskeisyys" value={bc.value.toFixed(3)} title={bc.interpretation} />
          <MetricCard label="Hallitusroolit" value={String(br.value)} title={br.interpretation} />
          <MetricCard label="Nimitykset" value={String(ar.value)} title={ar.interpretation} />
          <MetricCard label="Rahavirrat (€)" value={formatEur(fn.value)} title={fn.interpretation} />
          <MetricCard label="Tiedon luotettavuus" value={dc.value.toFixed(2)} title={dc.interpretation} />
        </div>
      </section>

      <EntityNetworkPosition entityId={entity.id} />

      <PoliticianMediaCoverage personEntityId={entity.id} />

      <IdentityBackgroundSection personEntityId={entity.id} />

      <PersonBenefitsSection personEntityId={entity.id} />

      {/* network */}
      <section aria-label="Verkosto">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className="section-title">Verkosto</h2>
          <span className="text-[11px] text-ink-300">
            Klikkaa solmua nähdäksesi tiedot · kaksoisklikkaa laajentaaksesi
          </span>
        </div>
        <GraphView entityId={entity.id} />
      </section>

      {/* positions */}
      <section aria-label="Tehtävät">
        <h2 className="section-title mb-2">Tehtävät</h2>
        <ul className="card divide-y divide-line">
          {profile.positions.length === 0 && (
            <li className="py-3 text-sm text-ink-500">Ei dokumentoituja tehtäviä.</li>
          )}
          {profile.positions.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.isCurrent ? "bg-emerald-500" : "bg-ink-300"}`} />
                <span className="text-sm font-medium text-ink-900">{p.role}</span>
                {p.organizationEntity && (
                  <Link href={entityUrlFor(p.organizationEntity.id, p.organizationEntity.type, p.organizationEntity.canonicalName)} className="text-sm text-accent hover:underline">
                    {p.organizationEntity.canonicalName}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <span>
                  {formatDate(p.startDate)} — {p.isCurrent ? "nykyhetki" : formatDate(p.endDate)}
                </span>
                {p.source && (
                  <a href={p.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    lähde
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* organizations / relationships */}
      <section aria-label="Yhteydet">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Yhteydet</h2>
          <span className="meta">{orgRelRows.length} dokumentoitua yhteyttä</span>
        </div>
        <RelationshipList rows={orgRelRows} emptyText="Ei dokumentoituja organisaatioyhteyksiä." />
      </section>

      {/* money */}
      <section aria-label="Rahavirrat">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Rahavirrat</h2>
          <Link href="/methodology#money" className="text-[11px] text-accent hover:underline">
            Laskentatapa →
          </Link>
        </div>
        {profile.flows.length === 0 && (
          <p className="text-sm text-ink-500">
            Ei dokumentoituja rahavirtoja. Rahavirtamalli on rakennettu; varsinaisten
            rahavirtalähteiden (vaalirahoitus, avustuspäätökset) käsittely on käynnissä.
          </p>
        )}
        <ul className="card divide-y divide-ink-100">
          {profile.flows.map((f) => {
            const out = f.payerEntityId === entity.id;
            const other = out ? f.recipientEntity : f.payerEntity;
            return (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-ink-300">{out ? "→" : "←"}</span>
                  <span className="text-sm text-ink-500">{out ? "maksaa" : "saa"}</span>
                  <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="text-sm font-medium text-accent hover:underline">
                    {other.canonicalName}
                  </Link>
                  {f.purpose && <span className="hidden text-xs text-ink-500 sm:inline">· {f.purpose}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                  <span className="font-semibold tabular-nums text-ink-900">{formatEur(f.amount)}</span>
                  <span>{formatDate(f.flowDate ?? f.periodStart)}</span>
                  {f.evidence[0]?.source && (
                    <a href={f.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      lähde
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* sources */}
      <section id="lahteet" aria-label="Lähteet" className="scroll-mt-20">
        <h2 className="section-title mb-2">Lähteet</h2>
        <ul className="card divide-y divide-line">
          {profile.sources.length === 0 && (
            <li className="py-3 text-sm text-muted">
              Ei erillisiä lähdeviittauksia tällä sivulla. Jokaisella yllä olevalla yhteydellä on oma lähteensä.
            </li>
          )}
          {profile.sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <a href={s.source.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {s.source.sourceName}
              </a>
              <span className="shrink-0 text-ink-300">{sourceTypeLabel(s.source.sourceType)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <div className="card" title={title}>
      <div className="text-lg font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{label}</div>
    </div>
  );
}