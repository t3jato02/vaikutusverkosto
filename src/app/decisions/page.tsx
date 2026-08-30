import { db } from "@/lib/db";
import { formatDate, formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await db.decision.findMany({
    orderBy: { decisionDate: "desc" },
    take: 50,
    include: {
      institutionEntity: { select: { id: true, canonicalName: true, type: true } },
      _count: { select: { votes: true } },
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Päätökset</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Päätökset, äänestykset ja päätöspolku: kuka valmisteli, kuka äänesti, kuka sai
          rahoituksen ja kuka vaikutti. Päätöstietokanta rakentuu vaiheittain — malli on valmis.
        </p>
      </header>

      {decisions.length === 0 && (
        <section className="card">
          <p className="text-sm text-ink-500">
            Ei tallennettuja päätöksiä vielä. Päätösmalli (instituutio, äänestys, rahoitusarvo,
            vaikutusalueet) on luotu, ja valtiopäiväasiakirjojen käsittely on seuraava vaihe.
          </p>
        </section>
      )}

      <ul className="card divide-y divide-ink-100">
        {decisions.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink-900">{d.title}</span>
              <span className="text-xs text-ink-500">
                {d.institutionEntity?.canonicalName ?? "—"} · {formatDate(d.decisionDate)}
                {d.financialValue ? ` · ${formatEur(d.financialValue)}` : ""}
              </span>
            </div>
            <span className="shrink-0 text-[11px] text-ink-300">{d._count.votes} ääntä</span>
          </li>
        ))}
      </ul>
    </div>
  );
}