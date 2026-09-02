import { getSources, getLatestAgentRuns } from "@/lib/queries";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const [sources, runs] = await Promise.all([getSources(300), getLatestAgentRuns(10)]);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Lähteet</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Kaikki julkaistu tieto on palautettavissa lähteeseen. Tältä sivulta näet käytetyt
          lähdeverkostot ja niiden kattavuuden.
        </p>
      </header>

      <section aria-label="Agenttien ajot">
        <h2 className="card-title mb-2">VIIMEISIMMÄT AGENTTIEN AJOT</h2>
        <ul className="card divide-y divide-ink-100">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 text-xs">
              <span className="font-medium text-ink-900">{r.agent}</span>
              <span className="min-w-0 flex-1 text-ink-500">
                {r.source?.sourceName ?? "—"} · {r.recordsScanned} tietuetta · {r.factsAccepted} hyväksytty · {r.errors} virhettä
              </span>
              <span className={`shrink-0 font-medium ${r.status === "SUCCESS" ? "text-emerald-600" : r.status === "PARTIAL" ? "text-amber-600" : "text-red-600"}`}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Lähdeverkosto">
        <h2 className="card-title mb-2">LÄHDEVERKOSTO</h2>
        <ul className="card divide-y divide-ink-100">
          {sources.length === 0 && <li className="py-3 text-sm text-ink-500">Ei lähteitä.</li>}
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-48">
                <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-accent hover:underline">
                  {s.sourceName}
                </a>
                <span className="block truncate text-[11px] text-ink-300">{s.sourceUrl}</span>
              </div>
              <div className="flex min-w-0 basis-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 sm:flex-1 sm:justify-end">
                <span className="min-w-0 break-words rounded bg-ink-100 px-1.5 py-0.5 text-[11px]">{s.sourceType}</span>
                <span className="whitespace-nowrap">{s._count.evidence} todistetta</span>
                <span className="whitespace-nowrap" title={formatDateLong(s.lastCheckedAt)}>tark. {formatDateLong(s.lastCheckedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}