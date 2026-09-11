import type { Metadata } from "next";
import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { entityUrlFor } from "@/lib/queries";
import { entityLabel } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import { networkAnalytics, type GraphScope, type Temporal } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Verkostoanalyysi",
  description:
    "Rakenteellisia verkostomittareita lähdeperustaisesta graafista. Ei moralisoivaa vaikuttamis-scorea.",
};
export const dynamic = "force-dynamic";

const SCOPES: { value: GraphScope; label: string; desc: string }[] = [
  { value: "organisational", label: "Organisaatioverkosto", desc: "jäsenyydet, hallituspaikat, työsuhteet, nimitykset" },
  { value: "funding", label: "Rahoitusverkosto", desc: "kaikki dokumentoidut rahavirrat" },
  { value: "international", label: "Kansainväliset yhteydet", desc: "ulkomaiset rahavirrat" },
  { value: "decision", label: "Päätösverkosto", desc: "äänestykset ja päätökset" },
  { value: "ownership", label: "Omistusverkosto", desc: "omistus ja osakkuudet" },
];
const TEMPORAL: { value: Temporal; label: string }[] = [
  { value: "current", label: "Nykyiset" },
  { value: "historical", label: "Historialliset" },
  { value: "all", label: "Kaikki" },
];
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const scope = (SCOPES.find((s) => s.value === sp.scope)?.value ?? "funding") as GraphScope;
  const temporal = (TEMPORAL.find((t) => t.value === sp.temporal)?.value ?? "current") as Temporal;
  const metricKey = (sp.metric === "betweenness" ? "betweenness" : sp.metric === "weighted" ? "weighted" : "degree") as
    | "degree" | "weighted" | "betweenness";
  const metric = metricKey === "betweenness" ? "byBetweenness" : metricKey === "weighted" ? "byWeightedDegree" : "byDegree";

  const a = await networkAnalytics(scope, temporal, {
    fromYear: sp.fromYear ? Number(sp.fromYear) : undefined,
    toYear: sp.toYear ? Number(sp.toYear) : undefined,
  });
  const rows = a.top[metric as keyof typeof a.top];
  const isMoney = scope === "funding" || scope === "international";
  const scopeMeta = SCOPES.find((s) => s.value === scope)!;

  // Human-readable names for the structural metrics. These describe the shape of
  // the selected network — never a person's conduct.
  const METRIC_LABELS: Record<typeof metricKey, { short: string; help: string }> = {
    degree: {
      short: "Yhteyksien määrä verkossa",
      help: "Kuinka moneen muuhun toimijaan tällä solmulla on suora dokumentoitu yhteys tässä verkossa.",
    },
    weighted: {
      short: isMoney ? "Dokumentoitujen rahayhteyksien paino" : "Painotettu yhteysmäärä",
      help: isMoney
        ? "Solmuun kytkeytyvien dokumentoitujen rahavirtojen yhteissumma euroina. Summa ei kerro rahan käyttötarkoituksesta."
        : "Yhteyksien määrä painotettuna yhteyden tyypillä.",
    },
    betweenness: {
      short: "Verkoston välittäjäasema",
      help: "Kuinka usein solmu on lyhimmällä polulla kahden muun toimijan välillä. Korkea arvo = rakenteellinen väliasema tiedon tai resurssien kulussa.",
    },
  };
  const activeMetric = METRIC_LABELS[metricKey];

  const q = (o: Record<string, string>) =>
    "?" + new URLSearchParams({ scope, temporal, metric: sp.metric ?? "degree", ...o }).toString();

  return (
    <div className="mx-auto max-w-content space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-page-title">Verkostoanalyysi</h1>
        <p className="mt-2 text-sm text-muted">
          Rakenteellisia mittareita lähdeperustaisesta graafista. Nämä kuvaavat <strong>verkon
          rakennetta</strong> — eivät henkilön moraalia, lainmukaisuutta tai syyllisyyttä.
          Järjestelmä ei laske &quot;vaikuttamis-scorea&quot;.{" "}
          <Link href="/methodology#network-metrics" className="text-accent hover:underline">Menetelmät</Link>.
        </p>
      </header>

      <nav aria-label="Verkoston tyyppi" className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <Link key={s.value} href={q({ scope: s.value })} className="chip" data-selected={scope === s.value} title={s.desc}>
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <span className="text-muted">Aika:</span>
        {TEMPORAL.map((t) => (
          <Link key={t.value} href={q({ temporal: t.value })} className="chip" data-selected={temporal === t.value}>
            {t.label}
          </Link>
        ))}
        <span className="ml-2 text-muted">Mittari:</span>
        {[
          { k: "degree", l: METRIC_LABELS.degree.short },
          { k: "weighted", l: METRIC_LABELS.weighted.short },
          { k: "betweenness", l: METRIC_LABELS.betweenness.short },
        ].map((m) => (
          <Link key={m.k} href={q({ metric: m.k })} className="chip" data-selected={metricKey === m.k}>

            {m.l}
          </Link>
        ))}
      </div>

      <p className="max-w-2xl rounded-md border border-line bg-surface p-3 text-[12px] text-muted">
        <strong className="text-ink">{activeMetric.short}.</strong> {activeMetric.help} Korkea sija
        tässä listassa <strong>ei</strong> tarkoita väärinkäytöstä, korruptiota, lainvastaisuutta tai
        epäasiallista vaikuttamista — se kuvaa vain toimijan asemaa dokumentoitujen yhteyksien
        verkossa.
      </p>

      <section aria-label="Tulokset">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">{scopeMeta.label}</h2>
          <details className="text-[11px]">
            <summary className="cursor-pointer text-accent">Miten tämä laskettiin?</summary>
            <div className="mt-1 rounded-md border border-line bg-surface p-3 text-muted">
              <p>Verkko: {scopeMeta.label} — {scopeMeta.desc}</p>
              <p>
                Ajallinen rajaus:{" "}
                {temporal === "current"
                  ? "vain nykyiset yhteydet — päättyneet jätetty pois"
                  : temporal === "historical"
                    ? "vain historialliset yhteydet"
                    : "kaikki yhteydet (nykyiset + historialliset)"}
              </p>
              <p>Mukana vain julkisesti näkyvät, lähteellä vahvistetut yhteydet.</p>
              <p>Algoritmi: {a.algorithm} (v{a.algorithmVersion})</p>
              <p>Solmuja: {a.nodeCount} · viivoja: {a.edgeCount}</p>
              <p>Laskettu: {new Date(a.calculatedAt).toLocaleString("fi-FI")} {a.cached ? "(välimuistista)" : "(tuore laskenta)"}</p>
              <p className="mt-1 italic">
                Korkea arvo tarkoittaa, että solmu kytkee rakenteellisesti valitun verkon osia. Se ei
                tarkoita väärinkäytöstä, korruptiota tai epäasiallista vaikuttamista.
              </p>
            </div>
          </details>
        </div>
        <ul className="card divide-y divide-line">
          {rows.length === 0 && <li className="py-3 text-sm text-muted">Ei dataa tälle verkolle näillä suodattimilla.</li>}
          {rows.map((r, i) => (
            <li key={r.entityId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="min-w-0 flex-1 basis-full [overflow-wrap:anywhere] sm:basis-auto">
                <span className="mr-2 tabular-nums text-ink-300">{i + 1}.</span>
                <Link href={entityUrlFor(r.entityId, r.type as EntityType, r.name)} className="font-medium text-ink hover:text-accent">
                  {r.name}
                </Link>
                <span className="ml-2 text-[11px] text-ink-300">{entityLabel(r.type as EntityType)}</span>
              </span>
              <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted">
                <span title="Yhteyksien määrä verkossa">{r.degree} yhteyttä</span>
                <span title={isMoney ? "Dokumentoitujen rahayhteyksien paino" : "Painotettu yhteysmäärä"}>
                  {isMoney ? formatEur(r.weightedDegree) : `paino ${r.weightedDegree}`}
                </span>
                <span title="Verkoston välittäjäasema">välittäjä {r.betweenness}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
