import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getLatestAgentRuns } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Hallinta" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [entityCount, relCount, verifiedCount, pendingCount, flowCount, corrections, runs, conflictCount, disputedCount] =
    await Promise.all([
      db.entity.count(),
      db.relationship.count(),
      db.relationship.count({ where: { verificationState: "PUBLISHED" } }),
      db.verificationQueue.count({ where: { status: "PENDING" } }),
      db.financialFlow.count(),
      db.correction.findMany({ where: { status: "SUBMITTED" }, orderBy: { createdAt: "desc" }, take: 10 }),
      getLatestAgentRuns(10),
      db.changeLog.count({ where: { eventType: "IDENTITY_MERGED" } }),
      db.relationship.count({ where: { confidence: "DISPUTED" } }),
    ]);

  const stats = [
    { label: "Toimijat (entities)", value: entityCount },
    { label: "Suhteet (relationships)", value: relCount },
    { label: "Varmennetut suhteet", value: verifiedCount },
    { label: "Rahavirrat", value: flowCount },
    { label: "Odottaa tarkistusta", value: pendingCount },
    { label: "Riidatut suhteet", value: disputedCount },
    { label: "Identiteettikonfliktit", value: conflictCount },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hallinta / tutkijanäkymä</h1>
          <p className="mt-1 text-sm text-ink-500">
            Tiedon kattavuus, agenttien ajot ja korjausjono. Pääsynvalvonta (RLS + roolit) on
            tuotantokäyttöön suunniteltu (vaihe D).
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs">
          <Link href="/admin/agents" className="btn">Agentit</Link>
          <Link href="/admin/evidence" className="btn">Todisteet</Link>
          <Link href="/admin/review" className="btn">Tarkistusjono</Link>
        </nav>
      </header>

      <section aria-label="Kattavuus">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {stats.map((s) => (
            <div key={s.label} className="card">
              <div className="text-xl font-bold tabular-nums tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-ink-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Agenttien ajot">
        <h2 className="card-title mb-2">AGENTTIEN AJOT</h2>
        <ul className="card divide-y divide-ink-100">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span className="font-medium text-ink-900">{r.agent}</span>
              <span className="text-ink-500">
                {formatDate(r.startedAt)} · {r.recordsScanned} tietuetta · {r.factsProposed} ehdotettu ·{" "}
                {r.factsAccepted} hyväksytty · {r.errors} virhettä
              </span>
              <span className={`font-semibold ${r.status === "SUCCESS" ? "text-emerald-600" : r.status === "PARTIAL" ? "text-amber-600" : "text-red-600"}`}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Korjausjono">
        <h2 className="card-title mb-2">KORJAUSJONO ({corrections.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {corrections.length === 0 && <li className="py-3 text-sm text-ink-500">Ei avoimia korjauspyyntöjä.</li>}
          {corrections.map((c) => (
            <li key={c.id} className="py-2.5 text-xs">
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{c.category}</span>{" "}
              <span className="text-ink-900">{c.description}</span>
              <span className="block text-ink-300">{formatDate(c.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}