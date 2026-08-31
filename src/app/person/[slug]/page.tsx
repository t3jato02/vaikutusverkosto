import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { resolveEntityBySlug, getPersonProfile, entityUrlFor } from "@/lib/queries";
import { relationshipLabel, TIERS } from "@/lib/constants";
import { formatDate, formatEur } from "@/lib/format";
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
import { ConfidenceBadge, FactBadge } from "@/components/badges";
import GraphView from "@/components/GraphView";

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
    openGraph: { title: entity.canonicalName, type: "profile", url: `https://vaikutusverkosto.example/person/${slug}` },
  };
}

type Profile = Awaited<ReturnType<typeof getPersonProfile>>;
type RelItem = {
  other: { id: string; canonicalName: string; type: EntityType };
  direction: "out" | "in";
  r: Profile["relationships"][number];
};

function relListItems(entity: Profile): RelItem[] {
  const out: RelItem[] = [];
  for (const r of entity.relationships) {
    if (r.sourceEntityId === entity.entity!.id) {
      out.push({ other: r.targetEntity, direction: "out", r });
    } else {
      out.push({ other: r.sourceEntity, direction: "in", r });
    }
  }
  return out;
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity || entity.type !== "PERSON") notFound();

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
  const orgRels = relListItems(profile).filter((x) => x.other.type !== "POLITICAL_PARTY");

  return (
    <div className="space-y-8">
      {/* header */}
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar
          name={entity.canonicalName}
          type="PERSON"
          imageUrl={entity.person?.imageUrl ?? null}
          size={88}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
          </div>
          {entity.person?.profession && (
            <p className="text-sm text-ink-500">{entity.person.profession}</p>
          )}
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
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {entity.person?.electoralDistrict && (
              <span>Vaalipiiri: {entity.person.electoralDistrict}</span>
            )}
            {entity.municipality && <span>Kotikunta: {entity.municipality}</span>}
            <span>Viimeksi varmennettu: {formatDate(entity.lastVerifiedAt)}</span>
            <span>Lähteet: {entity.sourceCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1">
          <span className="label">VALLAN TASO (JOHDETTU)</span>
          <span className="text-sm font-semibold" title="Algoritmilla johdettu rakenteellinen ulottuvuus, ei moraaliarvio">
            Taso {tier} — {TIERS[tier - 1]?.fi}
          </span>
          <Link href="/methodology#tiers" className="text-[11px] text-accent hover:underline">
            Menetelmä →
          </Link>
          <Link href="/corrections" className="mt-2 text-[11px] text-ink-500 hover:underline">
            Ilmoita virheestä
          </Link>
        </div>
      </section>

      {/* metrics */}
      <section aria-label="Mittarit">
        <h2 className="card-title mb-2">MITTARIT <span className="normal-case text-ink-300">(johdettuja, ei tuomioita)</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Institutionaalinen valta" value={String(ip.value)} title={ip.interpretation} />
          <MetricCard label="Verkostokeskeisyys" value={bc.value.toFixed(3)} title={bc.interpretation} />
          <MetricCard label="Hallitusroolit" value={String(br.value)} title={br.interpretation} />
          <MetricCard label="Nimitykset" value={String(ar.value)} title={ar.interpretation} />
          <MetricCard label="Rahavirrat (€)" value={formatEur(fn.value)} title={fn.interpretation} />
          <MetricCard label="Tiedon luotettavuus" value={dc.value.toFixed(2)} title={dc.interpretation} />
        </div>
      </section>

      {/* network */}
      <section aria-label="Verkosto">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="card-title">VERKOSTO</h2>
          <span className="text-[11px] text-ink-300">
            Klikkaa solmua avataksesi · kaksoisklikkaa laajentaaksesi · klikkaa viivaa nähdäksesi suhteen
          </span>
        </div>
        <GraphView entityId={entity.id} />
      </section>

      {/* positions */}
      <section aria-label="Tehtävät">
        <h2 className="card-title mb-2">TEHTÄVÄT</h2>
        <ul className="card divide-y divide-ink-100">
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
      <section aria-label="Organisaatioyhteydet">
        <h2 className="card-title mb-2">ORGANISAATIOYHTEYDET</h2>
        <ul className="card divide-y divide-ink-100">
          {orgRels.length === 0 && <li className="py-3 text-sm text-ink-500">Ei yhteyksiä.</li>}
          {orgRels.slice(0, 40).map(({ other, direction, r }) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <FactBadge kind="FACT" />
                {direction === "out" ? (
                  <>
                    <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="truncate text-sm font-medium text-ink-900 hover:text-accent">
                      {other.canonicalName}
                    </Link>
                    <span className="text-xs text-ink-500">{relationshipLabel(r.relationshipType as never)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-ink-500">{relationshipLabel(r.relationshipType as never)}</span>
                    <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="truncate text-sm font-medium text-ink-900 hover:text-accent">
                      {other.canonicalName}
                    </Link>
                  </>
                )}
                {r.role && <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">{r.role}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                <span>
                  {formatDate(r.startDate)} — {r.endDate ? formatDate(r.endDate) : "nykyhetki"}
                </span>
                {r.evidence[0]?.source && (
                  <a
                    href={r.evidence[0].source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-ink-200"
                  >
                    Näytä lähde
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* money */}
      <section aria-label="Rahavirrat">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="card-title">RAHAVIRRAT</h2>
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
      <section aria-label="Lähteet">
        <h2 className="card-title mb-2">LÄHTEET</h2>
        <ul className="card divide-y divide-ink-100">
          {profile.sources.length === 0 && (
            <li className="py-3 text-sm text-ink-500">
              Ei erillisiä lähdeviittauksia tällä sivulla. Jokaisella yhteydellä on lähde yllä olevissa listoissa.
            </li>
          )}
          {profile.sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <a href={s.source.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {s.source.sourceName}
              </a>
              <span className="shrink-0 text-ink-300">{s.source.sourceType}</span>
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