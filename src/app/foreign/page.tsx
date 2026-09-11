import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { entityUrlFor, projectUrlFor } from "@/lib/queries";
import { formatEur } from "@/lib/format";
import { foreignFundingOverview, buildForeignFundingWhere, type ForeignFundingFilters } from "@/lib/foreign";
import { FLOW_TYPE_LABELS, FUNDING_TYPE_LABELS, fundingTypeLabel, flowLabel } from "@/lib/constants";
import { verificationLabel } from "@/lib/labels";
import { formatDateLong } from "@/lib/format";
import ForeignFlowGraph from "@/components/LazyForeignFlowGraph";
import FilterBar from "@/components/FilterBar";

export const metadata: Metadata = {
  title: "Kansainväliset yhteydet",
  description:
    "Dokumentoitu ulkomainen rahoitus, omistus ja organisaatiosuhteet — sama evidenssistandardi kaikille maille ja organisaatioille.",
};
export const dynamic = "force-dynamic";

const FUNDING_TYPES = Object.keys(FUNDING_TYPE_LABELS);

export default async function ForeignPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filters: ForeignFundingFilters = {
    country: sp.country || undefined,
    fundingType: sp.fundingType || undefined,
    minAmount: sp.minAmount ? Number(sp.minAmount) : undefined,
    verifiedOnly: sp.verifiedOnly !== "false",
  };
  const overview = await foreignFundingOverview(filters);
  const recipientName = new Map(overview.recipientEntities.map((e) => [e.id, e]));
  const countryName = new Map(overview.countries.map((c) => [c.iso2, c.name]));

  const flows = await db.financialFlow.findMany({
    where: buildForeignFundingWhere(filters),
    orderBy: { amount: "desc" },
    take: 50,
    include: {
      payerEntity: { select: { id: true, canonicalName: true, type: true } },
      recipientEntity: { select: { id: true, canonicalName: true, type: true } },
      project: { select: { id: true, name: true, municipality: true } },
      evidence: { include: { source: true }, take: 3 },
    },
  });

  const yearSuffix = overview.yearMin
    ? overview.yearMin === overview.yearMax
      ? ` ${overview.yearMin}`
      : ` ${overview.yearMin}–${overview.yearMax}`
    : "";
  const cards = [
    { label: `Dokumentoitu rahoitus${yearSuffix}`, value: formatEur(overview.totalAmount) },
    { label: "Rahavirtoja", value: overview.flowCount },
    { label: "Maita", value: overview.countryCount },
    { label: "Vastaanottajia", value: overview.topRecipients.length },
  ];

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-page-title">Kansainväliset yhteydet</h1>
        <p className="mt-2 text-sm text-muted">
          <strong>Vain rajat ylittävät</strong> dokumentoidut rahavirrat ja yhteydet — ne, joissa
          rahoittajan tai omistajan maa ei ole Suomi. Kaikki rahavirrat (myös kotimaiset hankinnat
          ja avustukset):{" "}
          <Link href="/money" className="text-accent hover:underline">Raha</Link>. Sama
          evidenssistandardi koskee kaikkia maita; henkilön kansallisuus, etninen tausta tai uskonto
          ei itsessään ole vaikuttamissuhde eikä riskisignaali.{" "}
          <Link href="/methodology#international-funding" className="text-accent hover:underline">Menetelmät</Link>.
        </p>
      </header>

      <section aria-label="Yleiskuva">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card">
              <div className="text-lg font-bold tabular-nums">{c.value}</div>
              <div className="text-[11px] text-muted">{c.label}</div>
            </div>
          ))}
        </div>
        {overview.flowCount > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {overview.yearMin && (
              <span>
                Vuodet{" "}
                {overview.yearMin === overview.yearMax
                  ? overview.yearMin
                  : `${overview.yearMin}–${overview.yearMax}`}
              </span>
            )}
            <span>
              {(() => {
                const confirmed = overview.byStatus
                  .filter((s) => s.verificationStatus === "SOURCE_CONFIRMED" || s.verificationStatus === "HUMAN_VERIFIED")
                  .reduce((n, s) => n + s._count._all, 0);
                return confirmed === overview.flowCount
                  ? "Kaikki vahvistettu lähteestä"
                  : `${confirmed}/${overview.flowCount} vahvistettu lähteestä`;
              })()}
            </span>
            {overview.lastUpdated && <span>Päivitetty {formatDateLong(overview.lastUpdated)}</span>}
            <Link href="/sources" className="text-accent hover:underline">Lähteet →</Link>
          </p>
        )}
      </section>

      <FilterBar activeCount={[sp.country, sp.fundingType, sp.minAmount].filter(Boolean).length}>
        <form className="card flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-end" method="get">
          <label className="block">
            <span className="label mb-1 block text-xs">Maa</span>
            <select name="country" defaultValue={sp.country ?? ""} className="input h-9 py-0 sm:h-8">
              <option value="">Kaikki</option>
              {overview.countries.map((c) => (
                <option key={c.iso2} value={c.iso2}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-1 block text-xs">Rahoitustyyppi</span>
            <select name="fundingType" defaultValue={sp.fundingType ?? ""} className="input h-9 py-0 sm:h-8">
              <option value="">Kaikki</option>
              {FUNDING_TYPES.map((t) => <option key={t} value={t}>{fundingTypeLabel(t)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="verifiedOnly" value="true" defaultChecked={sp.verifiedOnly !== "false"} className="accent-accent" />
            Näytä vain vahvistetut yhteydet
          </label>
          <button type="submit" className="btn-primary text-xs">Suodata</button>
        </form>
      </FilterBar>

      <section aria-label="Rahoitus maittain">
        <h2 className="section-title mb-2">Rahoitus maittain</h2>
        <ul className="card divide-y divide-line">
          {overview.byCountry.filter((c) => c.funderCountryCode).length === 0 && (
            <li className="py-3 text-sm text-muted">
              Ei vielä dokumentoitua ulkomaista rahoitusta. Kansainväliset lähteet lisätään
              hallitusti (ks. Lähderekisteri). Malli, suodattimet ja API ovat valmiina.
            </li>
          )}
          {overview.byCountry
            .filter((c) => c.funderCountryCode)
            .map((c) => (
              <li key={c.funderCountryCode} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{countryName.get(c.funderCountryCode!) ?? c.funderCountryCode}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatEur(Number(c._sum.amount ?? 0))} · {c._count._all} virtaa
                </span>
              </li>
            ))}
        </ul>
      </section>

      {overview.byYear.length > 0 && (
        <section aria-label="Dokumentoitu ulkomainen rahoitus vuosittain">
          <h2 className="section-title mb-2">Dokumentoitu ulkomainen rahoitus vuosittain</h2>
          <p className="mb-2 text-[11px] text-muted">
            Summat suoraan lähdeaineiston raportointivuosilta. Väliin jääviä vuosia ei arvioida
            eikä interpoloida — näytämme vain ne vuodet, joilta on dokumentoituja rahavirtoja.
          </p>
          <ul className="card divide-y divide-line">
            {(() => {
              const max = Math.max(...overview.byYear.map((y) => y.amount), 1);
              return overview.byYear.map((y) => (
                <li key={y.year} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular-nums font-medium">{y.year}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatEur(y.amount)} · {y.flowCount} {y.flowCount === 1 ? "virta" : "virtaa"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-line">
                    <div className="h-full rounded bg-accent" style={{ width: `${Math.round((y.amount / max) * 100)}%` }} />
                  </div>
                </li>
              ));
            })()}
          </ul>
        </section>
      )}

      {flows.length > 0 && (
        <section aria-label="Rahavirtojen verkosto">
          <h2 className="section-title mb-2">Rahavirtojen verkosto</h2>
          <p className="mb-2 text-[11px] text-muted">
            Maa → rahoittaja → (välittäjä) → suomalainen saaja → hanke. Klikkaa viivaa nähdäksesi
            summan ja lähteet. Verkosto on rajattu; laajenna listalta.
          </p>
          <ForeignFlowGraph
            query={[
              sp.country ? `country=${encodeURIComponent(sp.country)}` : "",
              sp.fundingType ? `fundingType=${encodeURIComponent(sp.fundingType)}` : "",
              sp.minAmount ? `minAmount=${encodeURIComponent(sp.minAmount)}` : "",
            ].filter(Boolean).join("&")}
          />
        </section>
      )}

      <section aria-label="Rahavirrat">
        <h2 className="section-title mb-2">Rahavirrat ({flows.length})</h2>
        <ul className="card divide-y divide-line">
          {flows.length === 0 && <li className="py-3 text-sm text-muted">Ei tuloksia näillä suodattimilla.</li>}
          {flows.map((f) => (
            <li key={f.id} id={`flow-${f.id}`} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <Link href={entityUrlFor(f.payerEntity.id, f.payerEntity.type, f.payerEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.payerEntity.canonicalName}
                  </Link>
                  {f.intermediaryEntityId ? <span className="text-ink-300"> → välittäjä</span> : null}
                  <span className="text-ink-300"> → </span>
                  <Link href={entityUrlFor(f.recipientEntity.id, f.recipientEntity.type, f.recipientEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.recipientEntity.canonicalName}
                  </Link>
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{formatEur(Number(f.amount))} {f.currency}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted [overflow-wrap:anywhere]">
                {f.fundingType ? fundingTypeLabel(f.fundingType) : flowLabel(f.flowType)}
                {f.funderCountryCode ? ` · ${countryName.get(f.funderCountryCode) ?? f.funderCountryCode}` : ""}
                {f.project ? (
                  <>
                    {" · hanke: "}
                    <Link href={projectUrlFor(f.project.id, f.project.name)} className="text-accent hover:underline">
                      {f.project.name}
                    </Link>
                  </>
                ) : null}
                {f.periodYear ? ` · ${f.periodYear}` : ""} · {verificationLabel(f.verificationStatus).label}
                {" · "}
                {f.sourceCount === 1 ? "1 lähde" : `${f.sourceCount} lähdettä`}
              </p>
              {f.evidence.length > 0 && (
                <details className="mt-1 text-[11px]">
                  <summary className="cursor-pointer text-accent">Todisteet ({f.evidence.length})</summary>
                  <ul className="mt-1 space-y-1 pl-3">
                    {f.evidence.map((e) => (
                      <li key={e.id} className="text-muted">
                        <a href={e.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          {e.source.sourceName}
                        </a>{" "}
                        · {e.source.publisher ?? "—"}
                        {e.source.publicationDate ? ` · julkaistu ${formatDateLong(e.source.publicationDate)}` : ""}
                        {e.source.retrievedAt ? ` · haettu ${formatDateLong(e.source.retrievedAt)}` : ""}
                        {e.quotedFragment ? <span className="block italic">&ldquo;{e.quotedFragment}&rdquo;</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Suurimmat vastaanottajat">
        <h2 className="section-title mb-2">Suurimmat dokumentoidun rahoituksen vastaanottajat</h2>
        <ul className="card divide-y divide-line">
          {overview.topRecipients.length === 0 && <li className="py-3 text-sm text-muted">—</li>}
          {overview.topRecipients.map((r) => {
            const e = recipientName.get(r.recipientEntityId);
            return (
              <li key={r.recipientEntityId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {e ? (
                    <Link href={entityUrlFor(e.id, e.type, e.canonicalName)} className="text-accent hover:underline">{e.canonicalName}</Link>
                  ) : (
                    r.recipientEntityId.slice(0, 8)
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatEur(Number(r._sum.amount ?? 0))}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[11px] text-ink-300">
        Rahoitustyypit: {FUNDING_TYPES.map((t) => fundingTypeLabel(t)).join(", ")}. Rahavirrat
        kuvataan neutraalisti rahoituksena, sopimuksena, omistuksena tai dokumentoituna suhteena —
        ei automaattisesti &quot;vaikuttamisena&quot;. {Object.keys(FLOW_TYPE_LABELS).length}{" "}
        rahavirtaluokkaa.
      </p>
    </div>
  );
}
