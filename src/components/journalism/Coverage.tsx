"use client";

// Renders data-analysis distributions as accessible horizontal bars.
// Pure presentation; the numbers come from the server-side analysis result.

import type { CoverageResult, DistributionBucket, PartyCoverageBucket, PersonCoverageBucket, FramingEstimate } from "@/lib/analysis/types";
import { genreLabel } from "@/lib/journalism";
import { ContentAnalysisDisclaimer } from "./TrustLayer";

export function BarList({ buckets }: { buckets: DistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  if (buckets.length === 0) return <p className="text-sm text-ink-500">Ei aineistoa.</p>;
  return (
    <ul className="space-y-1.5">
      {buckets.slice(0, 12).map((b) => (
        <li key={b.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="truncate text-ink">{b.name}</span>
            <span className="text-xs tabular-nums text-ink-300">{b.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-accent/70"
              style={{ width: `${Math.max(3, (b.count / max) * 100)}%` }}
              role="img"
              aria-label={`${b.name}: ${b.count} juttua`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function GenreBars({ buckets }: { buckets: DistributionBucket[] }) {
  return (
    <ul className="space-y-1.5">
      {buckets.map((b) => (
        <li key={b.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-ink">{genreLabel(b.key as never)}</span>
          <span className="tabular-nums text-ink-300">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function PartyBars({ buckets, showFraming }: { buckets: PartyCoverageBucket[]; showFraming?: boolean }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  if (buckets.length === 0) return <p className="text-sm text-ink-500">Ei puoluekohtaista aineistoa tarkastelujaksolla.</p>;
  return (
    <ul className="space-y-2">
      {buckets.slice(0, 12).map((b) => (
        <li key={b.key} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{b.name}</span>
            <span className="tabular-nums text-xs text-ink-300">
              {b.count} juttua · {b.shareOfPoliticsPct} %
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(3, (b.count / max) * 100)}%` }} />
          </div>
          {showFraming && b.framing && (
            <p className="mt-0.5 text-[11px] text-ink-400">
              kehystys-arvo: {b.framing.positive}+ / {b.framing.neutral}· / {b.framing.critical}−{" "}
              <span className="text-ink-300">(automaattinen leksikonarvio, epätarkka)</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PoliticianBars({ buckets }: { buckets: PersonCoverageBucket[] }) {
  if (buckets.length === 0) return <p className="text-sm text-ink-500">Ei henkilökohtaista mainintatietoa.</p>;
  return (
    <ul className="space-y-1.5">
      {buckets.slice(0, 15).map((b) => (
        <li key={b.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-ink">
            {b.name}
            {b.isPolitician && <span className="ml-1.5 rounded bg-ink-100 px-1 text-[10px] text-ink-500">poliitikko</span>}
          </span>
          <span className="tabular-nums text-ink-300">{b.articleCount}</span>
        </li>
      ))}
    </ul>
  );
}

export function FramingChart({ framing }: { framing: FramingEstimate }) {
  if (framing.total === 0) return null;
  const w = (n: number) => `${(n / framing.total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div className="bg-emerald-400" style={{ width: w(framing.positive) }} title={`Positiivinen ${framing.positive}`} />
        <div className="bg-ink-300" style={{ width: w(framing.neutral) }} title={`Neutraali ${framing.neutral}`} />
        <div className="bg-amber-400" style={{ width: w(framing.critical) }} title={`Kriittinen ${framing.critical}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span><span className="font-semibold text-emerald-600">{framing.positive}</span> positiivinen</span>
        <span><span className="font-semibold text-ink-700">{framing.neutral}</span> neutraali</span>
        <span><span className="font-semibold text-amber-600">{framing.critical}</span> kriittinen</span>
      </div>
      <p className="mt-1 text-[11px] text-ink-400">{framing.limitation}</p>
    </div>
  );
}

/** Single coverage block used inside profile / index pages. */
export function CoveragePanel({ result, title, kind }: { result: CoverageResult; title: string; kind: "parties" | "politicians" | "genres" | "topics" | "framing" }) {
  return (
    <section aria-label={title}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <span className="text-[11px] text-ink-300">
          aineisto {result.corpusSize} juttua · {result.period.start ?? "?"} – {result.period.end ?? "nykyhetki"}
        </span>
      </div>
      {kind === "parties" && <PartyBars buckets={result.parties} showFraming />}
      {kind === "politicians" && <PoliticianBars buckets={result.politicians} />}
      {kind === "genres" && <GenreBars buckets={result.genres} />}
      {kind === "topics" && <BarList buckets={result.topics} />}
      {kind === "framing" && result.framing ? (
        <FramingChart framing={result.framing} />
      ) : (
        <p className="text-sm text-ink-500">Ei kehystysaineistoa.</p>
      )}
      <ContentAnalysisDisclaimer compact />
    </section>
  );
}