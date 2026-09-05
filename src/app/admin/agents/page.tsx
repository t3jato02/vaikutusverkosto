import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listAdapters } from "@/lib/agents/registry";
import { syncRegistry, listRegistry } from "@/lib/agents/sourceRegistry";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Agentit" };
export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const adapters = listAdapters();
  await syncRegistry();
  const registry = await listRegistry();
  const runs = await db.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 60,
    include: { source: { select: { sourceName: true, sourceUrl: true, status: true, consecutiveFailures: true, lastSuccessAt: true } } },
  });
  const byAgent = await db.agentRun.groupBy({
    by: ["agent"],
    _sum: { recordsScanned: true, recordsCreated: true, recordsUpdated: true, errors: true },
    _max: { startedAt: true },
    _count: { _all: true },
  });
  const lastRuns = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastRuns.has(r.agent)) lastRuns.set(r.agent, r);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agenttien ajot</h1>
        <Link href="/admin" className="btn text-xs">Takaisin</Link>
      </div>

      <section aria-label="Agentit">
        <h2 className="card-title mb-2">AGENTIT</h2>
        <ul className="card divide-y divide-ink-100">
          {adapters.map((a) => {
            const last = lastRuns.get(a.id);
            const lastSuccess = runs.find((r) => r.agent === a.id && r.status === "SUCCESS");
            const lastFailed = runs.find((r) => r.agent === a.id && (r.status === "FAILED" || r.status === "PARTIAL"));
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <span className="text-sm font-semibold text-ink-900">{a.name}</span>
                  <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-500">
                    {a.id}
                  </span>
                  <p className="text-xs text-ink-500">
                    Aikataulu: {a.schedule === "daily" ? "päivittäin (04:00 UTC)" : "viikoittain (ma 04:00 UTC)"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
                    {lastSuccess ? (
                      <span className="text-emerald-700">viime onnistui: {formatDate(lastSuccess.startedAt)}</span>
                    ) : (
                      <span className="text-ink-300">ei onnistuneita ajoja</span>
                    )}
                    {lastFailed ? (
                      <span className="text-amber-700">viime virheet: {formatDate(lastFailed.startedAt)} ({lastFailed.errors} virhettä)</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right text-xs text-ink-500">
                  {last ? (
                    <>
                      <p>Viime ajo: {formatDate(last.startedAt)} — {last.status}</p>
                      <p>
                        {last.recordsScanned} tietuetta · {last.recordsCreated} uutta · {last.recordsUpdated} päivitystä · {last.errors} virhettä
                      </p>
                    </>
                  ) : (
                    <p>Ei ajoja vielä</p>
                  )}
                </div>
                <form action={`/api/admin/agents/${a.id}/run`} method="post">
                  <button type="submit" className="btn text-xs">Aja nyt</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Lähderekisteri">
        <h2 className="card-title mb-2">LÄHDEREKISTERI</h2>
        <p className="mb-2 text-xs text-ink-500">
          Keskitetty rekisteri ingestion-lähteille. Kuvailevat kentät päivittyvät koodin
          adaptereista; tila (käytössä / kunto) säilyy.
        </p>
        <ul className="card divide-y divide-ink-100">
          {registry.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <span className="font-semibold text-ink-900">{s.name}</span>
                <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-500">{s.id}</span>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {s.publisher} · {s.reliabilityTier} · {s.format} · {s.updateCadence}
                  {s.termsUrl ? (
                    <>
                      {" · "}
                      <a href={s.termsUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">ehdot</a>
                    </>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  tarkistettu {formatDate(s.lastCheckedAt)} · onnistui {formatDate(s.lastSuccessAt)}
                  {s.consecutiveFailures > 0 ? ` · ${s.consecutiveFailures} peräkkäistä virhettä` : ""}
                </p>
                {s.lastError ? <p className="mt-0.5 truncate text-[11px] text-red-600">{s.lastError}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    !s.enabled
                      ? "bg-ink-100 text-ink-500"
                      : s.consecutiveFailures >= 3
                        ? "bg-red-50 text-red-700"
                        : s.consecutiveFailures > 0
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {s.enabled ? "KÄYTÖSSÄ" : "POIS"}
                </span>
                <form action={`/api/admin/sources/${s.id}/toggle`} method="post">
                  <button type="submit" className="btn text-xs">{s.enabled ? "Poista käytöstä" : "Ota käyttöön"}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Lähdekohtainen kunto">
        <h2 className="card-title mb-2">LÄHDETERVEYS</h2>
        <ul className="card divide-y divide-ink-100">
          {byAgent.map((b) => {
            const src = lastRuns.get(b.agent)?.source;
            return (
              <li key={b.agent} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-ink-900">{b.agent}</span>
                <span className="text-xs text-ink-500">
                  {(b._sum.recordsScanned ?? 0)} skannattu · {(b._sum.recordsCreated ?? 0)} uutta · {(b._sum.recordsUpdated ?? 0)} päivitystä · {(b._sum.errors ?? 0)} virhettä · {b._count._all} ajoa
                </span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${src?.status === "ACTIVE" || !src ? "bg-emerald-50 text-emerald-700" : src?.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  {src?.status ?? "ACTIVE"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Yksityiskohtaiset ajot">
        <h2 className="card-title mb-2">VIIMEISIMMÄT AJOT</h2>
        <ul className="card divide-y divide-ink-100">
          {runs.map((r) => {
            const durMs = r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null;
            const dur = durMs != null && durMs >= 0 ? `${Math.max(1, Math.round(durMs / 1000))} s` : "kesken";
            return (
              <li key={r.id} className="py-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink-900">{r.agent}</span>
                  <span className={`font-semibold ${r.status === "SUCCESS" ? "text-emerald-600" : r.status === "PARTIAL" ? "text-amber-600" : r.status === "SKIPPED" ? "text-ink-400" : "text-red-600"}`}>{r.status}</span>
                </div>
                <div className="text-ink-500">
                  {formatDate(r.startedAt)} · {dur} · skannattu {r.recordsScanned} · ehdotettu {r.factsProposed} · hyväksytty {r.factsAccepted} · hylätty {r.factsRejected} · uutta {r.recordsCreated} · päivitystä {r.recordsUpdated} · virheitä {r.errors}
                </div>
                {r.details && <div className="truncate text-ink-400">{r.details}</div>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}