import Link from "next/link";
import { getPersonProfile, entityUrlFor } from "@/lib/queries";
import { relationshipLabel, entityLabel } from "@/lib/constants";
import { formatDate, formatEur } from "@/lib/format";
import Avatar from "@/components/Avatar";
import { ConfidenceBadge, FactBadge } from "@/components/badges";
import GraphView from "@/components/GraphView";
import type { Prisma } from "@prisma/client";

export type OrgEntity = Prisma.EntityGetPayload<{
  include: { person: true; organization: true; aliases: true; externalIds: true };
}>;

export default async function OrganizationProfile({ entity }: { entity: OrgEntity }) {
  const profile = await getPersonProfile(entity.id);

  const members = profile.relationships.filter((r) => {
    const selfId = entity.id;
    return r.sourceEntityId === selfId || r.targetEntityId === selfId;
  });

  return (
    <div className="space-y-8">
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={entity.canonicalName} type={entity.type} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{entity.canonicalName}</h1>
            <ConfidenceBadge value={entity.confidence} />
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-500">
              {entityLabel(entity.type)}
            </span>
          </div>
          {entity.description && <p className="mt-1 text-sm text-ink-500">{entity.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {entity.municipality && <span>Kunta: {entity.municipality}</span>}
            {entity.region && <span>Alue: {entity.region}</span>}
            {entity.jurisdiction && <span>Jurisdiktio: {entity.jurisdiction}</span>}
            {entity.organization?.registrationNumber && (
              <span>Y-tunnus: {entity.organization.registrationNumber}</span>
            )}
            <span>Viimeksi varmennettu: {formatDate(entity.lastVerifiedAt)}</span>
            <span>Lähteet: {entity.sourceCount}</span>
          </div>
        </div>
        <Link href="/corrections" className="shrink-0 text-[11px] text-ink-500 hover:underline">
          Ilmoita virheestä
        </Link>
      </section>

      <section aria-label="Verkosto">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="card-title">VERKOSTO</h2>
          <span className="text-[11px] text-ink-300">
            Klikkaa solmua avataksesi · kaksoisklikkaa laajentaaksesi
          </span>
        </div>
        <GraphView entityId={entity.id} />
      </section>

      <section aria-label="Suhteet">
        <h2 className="card-title mb-2">SUHTEET</h2>
        <ul className="card divide-y divide-ink-100">
          {members.length === 0 && <li className="py-3 text-sm text-ink-500">Ei suhteita.</li>}
          {members.slice(0, 60).map((r) => {
            const selfId = entity.id;
            const out = r.sourceEntityId === selfId;
            const other = out ? r.targetEntity : r.sourceEntity;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FactBadge kind="FACT" />
                  {!out && (
                    <span className="text-xs text-ink-500">{relationshipLabel(r.relationshipType)}</span>
                  )}
                  <Link
                    href={entityUrlFor(other.id, other.type, other.canonicalName)}
                    className="truncate text-sm font-medium text-ink-900 hover:text-accent"
                  >
                    {other.canonicalName}
                  </Link>
                  {out && (
                    <span className="text-xs text-ink-500">{relationshipLabel(r.relationshipType)}</span>
                  )}
                  {r.role && (
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">{r.role}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                  <span>
                    {formatDate(r.startDate)} — {r.endDate ? formatDate(r.endDate) : "nykyhetki"}
                  </span>
                  {r.evidence[0]?.source && (
                    <a href={r.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      lähde
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Rahavirrat">
        <h2 className="card-title mb-2">RAHAVIRRAT</h2>
        {profile.flows.length === 0 && (
          <p className="text-sm text-ink-500">Ei dokumentoituja rahavirtoja.</p>
        )}
        <ul className="card divide-y divide-ink-100">
          {profile.flows.map((f) => {
            const out = f.payerEntityId === entity.id;
            const other = out ? f.recipientEntity : f.payerEntity;
            return (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-ink-300">{out ? "→" : "←"}</span>
                  <Link href={entityUrlFor(other.id, other.type, other.canonicalName)} className="text-sm font-medium text-accent hover:underline">
                    {other.canonicalName}
                  </Link>
                  {f.purpose && (
                    <span className="hidden text-xs text-ink-500 sm:inline">· {f.purpose}</span>
                  )}
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
    </div>
  );
}