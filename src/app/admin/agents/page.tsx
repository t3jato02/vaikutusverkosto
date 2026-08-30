import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDateLong } from "@/lib/format";

export const metadata: Metadata = { title: "Agentit" };
export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const runs = await db.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { source: { select: { sourceName: true, sourceUrl: true } } },
  });
  const byAgent = await db.agentRun.groupBy({
    by: ["agent"],
    _sum: { recordsScanned: true, factsAccepted: true, errors: true },
    _count: { _all: true },
  });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Agenttien ajot</h1>
      <section aria-label="Yhteenveto agenttikohtaisesti">
        <ul className="card divide-y divide-ink-100">
          {byAgent.map((a) => (
            <li key={a.agent} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-semibold text-ink-900">{a.agent}</span>
              <span className="text-xs text-ink-500">
                {a._count._all} ajoa · {(a._sum.recordsScanned ?? 0)} tietuetta · {(a._sum.factsAccepted ?? 0)} hyväksytty · {(a._sum.errors ?? 0)} virhettä
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Yksityiskohtaiset ajot">
        <ul className="card divide-y divide-ink-100">
          {runs.map((r) => (
            <li key={r.id} className="py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink-900">{r.agent}</span>
                <span className={r.status === "SUCCESS" ? "text-emerald-600" : "text-amber-600"}>{r.status}</span>
              </div>
              <div className="text-ink-500">
                Alkoi {formatDateLong(r.startedAt)}{r.finishedAt ? ` · kesti ${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s` : ""}
              </div>
              <div className="text-ink-300">
                skannattu {r.recordsScanned} · ehdotettu {r.factsProposed} · hyväksytty {r.factsAccepted} · hylätty {r.factsRejected} · virheitä {r.errors}
              </div>
              {r.source && (
                <a href={r.source.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-accent hover:underline">
                  {r.source.sourceName}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}