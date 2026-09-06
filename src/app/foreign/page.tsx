import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { entityUrlFor } from "@/lib/queries";
import { formatEur } from "@/lib/format";
import { foreignFundingOverview, buildForeignFundingWhere, type ForeignFundingFilters } from "@/lib/foreign";
import { FLOW_TYPE_LABELS } from "@/lib/constants";
import { formatDateLong } from "@/lib/format";
import ForeignFlowGraph from "@/components/ForeignFlowGraph";

export const metadata: Metadata = {
  title: "Kansainväliset yhteydet",
  description:
    "Dokumentoitu ulkomainen rahoitus, omistus ja organisaatiosuhteet — sama evidenssistandardi kaikille maille ja organisaatioille.",
};
export const dynamic = "force-dynamic";

const FUNDING_TYPES = ["GRANT", "DONATION", "INVESTMENT", "PROCUREMENT", "LOAN", "SPONSORSHIP", "MEMBERSHIP_FEE", "OTHER"];

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

  const cards = [
    { label: "Dokumentoitu rahoitus", value: formatEur(overview.totalAmount) },
    { label: "Rahavirtoja", value: overview.flowCount },
    { label: "Maita", value: overview.countryCount },
    { label: "Vastaanottajia", value: overview.topRecipients.length },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Kansainväliset yhteydet</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Dokumentoitu <strong>ulkomainen rahoitus</strong>, omistus ja organisaatiosuhteet. Sama
          evidenssistandardi koskee kaikkia maita ja organisaatioita. Henkilön kansallisuus, etninen
          tausta tai uskonto ei itsessään ole vaikuttamissuhde eikä riskisignaali — merkitystä on
          vain dokumentoidulla rahoituksella, omistuksella, tehtävällä, sopimuksella tai päätöksellä.{" "}
          <Link href="/methodology" className="text-accent hover:underline">Menetelmät</Link>.
        </p>
      </header>

      <section aria-label="Yleiskuva">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card">
              <div className="text-lg font-bold tabular-nums">{c.value}</div>
              <div className="text-[11px] text-ink-500">{c.label}</div>
            </div>
          ))}
        </div>
      </section>

      <form className="card flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="block">
          <span className="label mb-1 block text-xs">Maa</span>
          <select name="country" defaultValue={sp.country ?? ""} className="input h-8 py-0">
            <option value="">Kaikki</option>
            {overview.countries.map((c) => (
              <option key={c.iso2} value={c.iso2}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label mb-1 block text-xs">Rahoitustyyppi</span>
          <select name="fundingType" defaultValue={sp.fundingType ?? ""} className="input h-8 py-0">
            <option value="">Kaikki</option>
            {FUNDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" name="verifiedOnly" value="true" defaultChecked={sp.verifiedOnly !== "false"} />
          Näytä vain vahvistetut yhteydet
        </label>
        <button type="submit" className="btn text-xs">Suodata</button>
      </form>

      <section aria-label="Rahoitus maittain">
        <h2 className="card-title mb-2">RAHOITUS MAITTAIN</h2>
        <ul className="card divide-y divide-ink-100">
          {overview.byCountry.filter((c) => c.funderCountryCode).length === 0 && (
            <li className="py-3 text-sm text-ink-500">
              Ei vielä dokumentoitua ulkomaista rahoitusta. Kansainväliset lähteet lisätään
              hallitusti (ks. Lähderekisteri). Malli, suodattimet ja API ovat valmiina.
            </li>
          )}
          {overview.byCountry
            .filter((c) => c.funderCountryCode)
            .map((c) => (
              <li key={c.funderCountryCode} className="flex items-center justify-between py-2 text-sm">
                <span>{countryName.get(c.funderCountryCode!) ?? c.funderCountryCode}</span>
                <span className="tabular-nums text-ink-500">
                  {formatEur(Number(c._sum.amount ?? 0))} · {c._count._all} virtaa
                </span>
              </li>
            ))}
        </ul>
      </section>

      {flows.length > 0 && (
        <section aria-label="Rahavirtojen verkosto">
          <h2 className="card-title mb-2">RAHAVIRTOJEN VERKOSTO</h2>
          <p className="mb-2 text-[11px] text-ink-500">
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
        <h2 className="card-title mb-2">RAHAVIRRAT ({flows.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {flows.length === 0 && <li className="py-3 text-sm text-ink-500">Ei tuloksia näillä suodattimilla.</li>}
          {flows.map((f) => (
            <li key={f.id} id={`flow-${f.id}`} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <Link href={entityUrlFor(f.payerEntity.id, f.payerEntity.type, f.payerEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.payerEntity.canonicalName}
                  </Link>
                  {f.intermediaryEntityId ? <span className="text-ink-400"> → välittäjä</span> : null}
                  <span className="text-ink-400"> → </span>
                  <Link href={entityUrlFor(f.recipientEntity.id, f.recipientEntity.type, f.recipientEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.recipientEntity.canonicalName}
                  </Link>
                </span>
                <span className="tabular-nums font-semibold">{formatEur(Number(f.amount))} {f.currency}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">
                {f.fundingType ?? f.flowType}
                {f.rawFundingType ? ` (${f.rawFundingType})` : ""}
                {f.funderCountryCode ? ` · ${countryName.get(f.funderCountryCode) ?? f.funderCountryCode}` : ""}
                {f.project ? ` · hanke: ${f.project.name}` : ""}
                {f.periodYear ? ` · ${f.periodYear}` : ""} · {f.verificationStatus} · {f.sourceCount} lähde(ttä)
              </p>
              {f.evidence.length > 0 && (
                <details className="mt-1 text-[11px]">
                  <summary className="cursor-pointer text-accent">Todisteet ({f.evidence.length})</summary>
                  <ul className="mt-1 space-y-1 pl-3">
                    {f.evidence.map((e) => (
                      <li key={e.id} className="text-ink-500">
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
        <h2 className="card-title mb-2">SUURIMMAT VASTAANOTTAJAT</h2>
        <ul className="card divide-y divide-ink-100">
          {overview.topRecipients.length === 0 && <li className="py-3 text-sm text-ink-500">—</li>}
          {overview.topRecipients.map((r) => {
            const e = recipientName.get(r.recipientEntityId);
            return (
              <li key={r.recipientEntityId} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {e ? (
                    <Link href={entityUrlFor(e.id, e.type, e.canonicalName)} className="text-accent hover:underline">{e.canonicalName}</Link>
                  ) : (
                    r.recipientEntityId.slice(0, 8)
                  )}
                </span>
                <span className="tabular-nums text-ink-500">{formatEur(Number(r._sum.amount ?? 0))}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[11px] text-ink-400">
        Tyyppiselitteet: {FUNDING_TYPES.join(", ")}. Rahavirta-tyypit kuvataan neutraalisti
        rahoituksena, sopimuksena, omistuksena tai dokumentoituna suhteena — ei automaattisesti
        &quot;vaikuttamisena&quot;. {Object.keys(FLOW_TYPE_LABELS).length} rahavirtaluokkaa.
      </p>
    </div>
  );
}
