import Link from "next/link";
import type { Metadata } from "next";
import { searchEntities, searchMoney, searchProjects, projectUrlFor } from "@/lib/queries";
import { entityLabel } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const metadata: Metadata = { title: "Haku" };
export const dynamic = "force-dynamic";

const CATEGORY_ORDER: Record<string, string> = {
  PERSON: "HENKILÖT",
  POLITICAL_PARTY: "PUOLUEET",
  ORGANIZATION: "ORGANISAATIOT",
  COMPANY: "YRITYKSET",
  GOVERNMENT_BODY: "INSTITUUTIOT",
  PENSION_INSTITUTION: "ELÄKELAITOKSET",
  MEDIA_ORGANIZATION: "MEDIA",
  EDUCATIONAL_INSTITUTION: "OPPILAITOKSET",
  COURT: "TUOMIOISTUIMET",
  PUBLIC_AUTHORITY: "VIRANOMAISET",
  ASSOCIATION: "YHDISTYKSET",
  FOUNDATION: "SÄÄTIÖT",
  UNION: "LIITOT",
  OTHER: "MUUT",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let results: Awaited<ReturnType<typeof searchEntities>> = [];
  let money: Awaited<ReturnType<typeof searchMoney>> = [];
  let projects: Awaited<ReturnType<typeof searchProjects>> = [];
  if (query) {
    [results, money, projects] = await Promise.all([
      searchEntities(query, 50),
      searchMoney(query, 5),
      searchProjects(query, 15),
    ]);
  }

  const grouped = new Map<string, typeof results>();
  for (const r of results) {
    const key = CATEGORY_ORDER[r.type] ?? "MUUT";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Haku</h1>
      <form action="/search" method="get" role="search">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Hae henkilöä, yritystä, kuntaa, puoluetta tai päätöstä…"
            className="input"
            autoFocus
          />
          <button type="submit" className="btn-primary shrink-0">
            Hae
          </button>
        </div>
      </form>

      {!query && <p className="text-sm text-ink-500">Kirjoita hakusana aloittaaksesi.</p>}

      {query && results.length === 0 && money.length === 0 && projects.length === 0 && (
        <p className="text-sm text-ink-500">
          Ei tuloksia haulle “{query}”. Kokeile toista kirjoitusasua tai nimeä.
        </p>
      )}

      {grouped.size > 0 &&
        [...grouped.entries()].map(([category, items]) => (
          <section key={category}>
            <h2 className="card-title mb-2">{category}</h2>
            <ul className="card divide-y divide-ink-100">
              {items.map((r) => (
                <li key={r.id}>
                  <Link href={r.url} className="flex items-center gap-3 py-2.5 hover:bg-ink-100/60">
                    <Avatar name={r.canonicalName} type={r.type as never} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-900">{r.canonicalName}</span>
                      {r.subtitle && (
                        <span className="block truncate text-xs text-ink-500">{r.subtitle}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-300">
                      {entityLabel(r.type as never)} · {r.sourceCount} lähdettä
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {projects.length > 0 && (
        <section>
          <h2 className="card-title mb-2">HANKKEET</h2>
          <ul className="card divide-y divide-ink-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={projectUrlFor(p.id, p.name)} className="flex items-center justify-between gap-3 py-2.5 hover:bg-ink-100/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900 [overflow-wrap:anywhere]">{p.name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {[p.programme, p.flows[0]?.recipientEntity?.canonicalName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-300">HANKE</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {money.length > 0 && (
        <section>
          <h2 className="card-title mb-2">RAHAVIRRAT</h2>
          <ul className="card divide-y divide-ink-100">
            {money.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-ink-900">{m.payerEntity.canonicalName}</span>
                  <span className="text-ink-300"> → </span>
                  <span className="font-medium text-ink-900">{m.recipientEntity.canonicalName}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {m.purpose ?? m.flowType}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatEur(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}