import Link from "next/link";
import { getPersonProfile, entityUrlFor } from "@/lib/queries";
import { entityLabel, fundingTypeLabel, countryLabel } from "@/lib/constants";
import { formatDate, formatDateLong, formatEur } from "@/lib/format";
import { toRelRows, sortRelRows } from "@/lib/relRows";
import Avatar from "@/components/Avatar";
import { ConfidenceBadge } from "@/components/badges";
import RelationshipList from "@/components/RelationshipList";
import GraphView from "@/components/GraphView";
import type { Prisma } from "@prisma/client";

export type OrgEntity = Prisma.EntityGetPayload<{
  include: { person: true; organization: true; aliases: true; externalIds: true };
}>;

export default async function OrganizationProfile({ entity }: { entity: OrgEntity }) {
  const profile = await getPersonProfile(entity.id);
  const relRows = sortRelRows(toRelRows(profile.relationships, entity.id));
  const foreignFlows = profile.flows.filter((f) => f.isForeign);

  return (
    <div className="space-y-8">
      {/* entity hero */}
      <section className="card-pad flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={entity.canonicalName} type={entity.type} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">
            {entityLabel(entity.type)}
            {entity.jurisdiction ? ` · ${entity.jurisdiction}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-entity-title">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
          </div>
          {entity.description && <p className="mt-1 text-sm text-muted">{entity.description}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
            <div>
              <dt className="inline text-ink-300">Yhteyksiä: </dt>
              <dd className="inline font-medium text-ink-700">{relRows.length}</dd>
            </div>
            <div>
              <dt className="inline text-ink-300">Lähteitä: </dt>
              <dd className="inline font-medium text-ink-700">{entity.sourceCount}</dd>
            </div>
            {entity.municipality && (
              <div>
                <dt className="inline text-ink-300">Kunta: </dt>
                <dd className="inline font-medium text-ink-700">{entity.municipality}</dd>
              </div>
            )}
            {entity.organization?.registrationNumber && (
              <div>
                <dt className="inline text-ink-300">Y-tunnus: </dt>
                <dd className="inline font-medium text-ink-700">{entity.organization.registrationNumber}</dd>
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
            <Link href="#yhteydet" className="btn-primary">Näytä yhteydet</Link>
            <Link href="/corrections" className="btn">Ilmoita virheestä</Link>
          </div>
        </div>
      </section>

      <section aria-label="Verkosto">
        <h2 className="section-title mb-2">Verkosto</h2>
        <GraphView entityId={entity.id} />
      </section>

      <section id="yhteydet" aria-label="Yhteydet" className="scroll-mt-20">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">Yhteydet</h2>
          <span className="meta">{relRows.length} dokumentoitua yhteyttä</span>
        </div>
        <RelationshipList rows={relRows} emptyText="Ei dokumentoituja yhteyksiä tälle toimijalle." />
      </section>

      <section aria-label="Rahavirrat">
        <h2 className="section-title mb-2">Rahavirrat</h2>
        {profile.flows.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">
            Tälle toimijalle ei ole vielä dokumentoituja rahavirtoja.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {profile.flows.map((f) => {
              const out = f.payerEntityId === entity.id;
              const other = out ? f.recipientEntity : f.payerEntity;
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-300" aria-hidden>{out ? "→" : "←"}</span>
                    <span className="text-sm text-muted">{out ? "maksaa" : "saa"}</span>
                    <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="text-sm font-medium text-accent hover:underline">
                      {other.canonicalName}
                    </Link>
                    {f.purpose && <span className="hidden text-xs text-muted sm:inline">· {f.purpose}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                    <span className="font-semibold tabular-nums text-ink">{formatEur(f.amount)}</span>
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
        )}
      </section>

      {foreignFlows.length > 0 && (
        <section aria-label="Kansainväliset yhteydet">
          <h2 className="section-title mb-1">Kansainväliset yhteydet</h2>
          <p className="mb-2 text-xs text-muted">
            Dokumentoitu ulkomainen rahoitus tälle toimijalle. Sama lähdevaatimus kaikille maille.
          </p>
          <ul className="card divide-y divide-line">
            {foreignFlows.map((f) => {
              const out = f.payerEntityId === entity.id;
              const other = out ? f.recipientEntity : f.payerEntity;
              return (
                <li key={`fx-${f.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="font-medium text-accent hover:underline">
                      {other.canonicalName}
                    </Link>
                    {f.funderCountryCode ? <span className="text-muted"> · {countryLabel(f.funderCountryCode)}</span> : null}
                    {f.fundingType ? <span className="text-muted"> · {fundingTypeLabel(f.fundingType)}</span> : null}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted">
                    <span className="font-semibold tabular-nums text-ink">{formatEur(f.amount)} {f.currency}</span>
                    {f.evidence[0]?.source && (
                      <a href={f.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
