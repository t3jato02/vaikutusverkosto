import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPersonProfile, resolveShortId, entityUrlFor } from "@/lib/queries";
import { computeComparison, type ComparisonItem } from "@/lib/analysis/engine";
import { genreLabel, journalistSubtypeLabel } from "@/lib/journalism";
import { isJournalistSubtype } from "@/lib/journalism";
import Avatar from "@/components/Avatar";
import { institutionalPower, networkCentrality, boardReach, appointmentReach, financialNetwork, dataConfidence, type PersonMetricInput, type RelationshipInput } from "@/lib/metrics";
import { formatEur } from "@/lib/format";

export const metadata: Metadata = { title: "Vertailu" };
export const dynamic = "force-dynamic";

async function resolveParam(slug: string) {
  const m = slug.match(/-([0-9a-f]{8})$/);
  if (m) {
    const full = await resolveShortId(m[1]);
    if (full) return db.entity.findUnique({ where: { id: full } });
  }
  return db.entity.findFirst({ where: { canonicalName: { equals: slug.replace(/-/g, " "), mode: "insensitive" as const } } });
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; c?: string; d?: string; e?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const { a, b, mode } = params;
  const ids = ["a", "b", "c", "d", "e"] as const;
  const selected = ids.filter((k) => params[k]).map((k) => params[k]!);

  // Coverage comparison mode — journalists or media (sections 14, 16).
  if (mode === "journalists" || mode === "media") {
    const scope = mode === "journalists" ? "JOURNALIST" : "MEDIA_OUTLET";
    const resolved: ComparisonItem[] = [];
    for (const slug of selected.slice(0, 5)) {
      const m = slug.match(/-([0-9a-f]{8})$/);
      let entity = null;
      if (m) {
        const full = await resolveShortId(m[1]);
        if (full) entity = await db.entity.findUnique({ where: { id: full } });
      } else {
        entity = await db.entity.findFirst({ where: { canonicalName: { equals: slug.replace(/-/g, " "), mode: "insensitive" } } });
      }
      if (!entity) continue;
      const typeOk = mode === "journalists" ? entity.type === "PERSON" && isJournalistSubtype(entity.subtype) : entity.type === "MEDIA_ORGANIZATION";
      if (!typeOk) continue;
      const rows = await computeComparison(scope, [entity.id], {});
      if (rows[0]) resolved.push(rows[0]);
    }
    return <JournalistMediaCompareView mode={mode} items={resolved} />;
  }

  const entities = [a, b].map((slug) => (slug ? resolveParam(slug) : Promise.resolve(null)));
  const [ea, eb] = await Promise.all(entities);
  if ((a && !ea) || (b && !eb)) notFound();

  async function metricsFor(id: string) {
    const profile = await getPersonProfile(id);
    const relInputs: RelationshipInput[] = profile.relationships.map((r) => ({
      type: r.relationshipType as never,
      confidence: r.confidence,
      startDate: r.startDate,
      endDate: r.endDate,
      amount: r.amount ? { value: Number(r.amount) } : null,
    }));
    const input: PersonMetricInput = {
      positions: profile.positions.map((p) => ({ role: p.role, isCurrent: p.isCurrent })),
      relationships: relInputs,
      incomingFlows: profile.flows.filter((f) => f.recipientEntityId === id).map((f) => ({ amount: Number(f.amount), confidence: f.confidence, flowType: f.flowType })),
      outgoingFlows: profile.flows.filter((f) => f.payerEntityId === id).map((f) => ({ amount: Number(f.amount), confidence: f.confidence, flowType: f.flowType })),
      sources: profile.entity?.sourceCount ?? 0,
    };
    const orgIds = new Set<string>();
    for (const r of profile.relationships) {
      const otherId = r.sourceEntityId === id ? r.targetEntityId : r.sourceEntityId;
      orgIds.add(otherId);
    }
    return {
      entity: profile.entity,
      metrics: {
        institutional: institutionalPower(input).value,
        centrality: networkCentrality(relInputs, 400).value,
        boards: boardReach(input).value,
        appointments: appointmentReach(input).value,
        finance: financialNetwork(input).value,
        confidence: dataConfidence(input).value,
      },
      relationships: profile.relationships,
      orgIds,
      positions: profile.positions.length,
    };
  }

  const [left, right] = [ea, eb].map((e) => (e ? metricsFor(e.id) : Promise.resolve(null)));
  const [L, R] = await Promise.all([left, right]);

  const rows: { label: string; l: string; r: string; kind?: "num" }[] = [];
  if (L && R) {
    rows.push(
      { label: "Institutionaalinen valta", l: String(L.metrics.institutional), r: String(R.metrics.institutional) },
      { label: "Verkostokeskeisyys", l: L.metrics.centrality.toFixed(3), r: R.metrics.centrality.toFixed(3) },
      { label: "Hallitusroolit", l: String(L.metrics.boards), r: String(R.metrics.boards) },
      { label: "Nimitykset", l: String(L.metrics.appointments), r: String(R.metrics.appointments) },
      { label: "Rahavirrat (€)", l: formatEur(L.metrics.finance), r: formatEur(R.metrics.finance) },
      { label: "Tiedon luotettavuus", l: L.metrics.confidence.toFixed(2), r: R.metrics.confidence.toFixed(2) },
      { label: "Dokumentoidut yhteydet", l: String(L.relationships.length), r: String(R.relationships.length) },
      { label: "Tehtävät", l: String(L.positions), r: String(R.positions) },
    );
  }

  const overlap = L && R ? [...L.orgIds].filter((id) => R!.orgIds.has(id)) : [];
  const overlapNames = overlap.length
    ? await db.entity.findMany({ where: { id: { in: overlap } }, select: { id: true, canonicalName: true, type: true } })
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Vertailu</h1>
        <p className="mt-1 text-sm text-ink-500">
          Vertaa henkilöiden ja organisaatioiden dokumentoituja mittareita, yhteyksiä ja
          päällekkäisiä verkostoja.
        </p>
      </header>

      <form className="card flex flex-col gap-3 sm:flex-row" action="/compare" method="get">
        <input name="a" defaultValue={a ?? ""} placeholder="Henkilö tai organisaatio A" className="input" />
        <input name="b" defaultValue={b ?? ""} placeholder="Henkilö tai organisaatio B" className="input" />
        <button className="btn-primary shrink-0" type="submit">Vertaa</button>
      </form>

      {L && R && (
        <>
          <section aria-label="Mittarit" className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-ink-500">Mittari</th>
                  <th className="px-4 py-2 text-left font-semibold">
                    <span className="flex items-center gap-2">
                      <Avatar name={L.entity!.canonicalName} type={L.entity!.type} size={24} />
                      {L.entity!.canonicalName}
                    </span>
                  </th>
                  <th className="px-4 py-2 text-left font-semibold">
                    <span className="flex items-center gap-2">
                      <Avatar name={R.entity!.canonicalName} type={R.entity!.type} size={24} />
                      {R.entity!.canonicalName}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-ink-100/60 last:border-0">
                    <td className="py-2 pr-4 text-ink-500">{r.label}</td>
                    <td className="px-4 py-2 font-semibold tabular-nums">{r.l}</td>
                    <td className="px-4 py-2 font-semibold tabular-nums">{r.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ink-300">
              Kaikki mittarit ovat johdettuja (JOHDETTU) eivätkä ole tuomio. Katso menetelmät.
            </p>
          </section>

          <section aria-label="Päällekkäiset verkostot">
            <h2 className="card-title mb-2">YHTEISET ORGANISAATIOT</h2>
            <ul className="card divide-y divide-ink-100">
              {overlapNames.length === 0 && (
                <li className="py-3 text-sm text-ink-500">Ei dokumentoituja yhteisiä organisaatioita.</li>
              )}
              {overlapNames.map((o) => (
                <li key={o.id} className="py-2 text-sm font-medium text-ink-900">
                  {o.canonicalName}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {(!L || !R) && (
        <p className="text-sm text-ink-500">
          Anna kaksi hakusanaa (esim. kaksi henkilöä) vertailua varten.
        </p>
      )}
    </div>
  );
}

/** Media/journalist comparison view (sections 14, 16) — data side by side, no winner. */
async function JournalistMediaCompareView({ mode, items }: { mode: "journalists" | "media"; items: ComparisonItem[] }) {
  const title = mode === "journalists" ? "Vertaa toimittajia" : "Vertaa medioita";
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Puoluekohtainen käsittely, juttutyypit ja aihealueet rinnakkain. Näytetään data — ei päätetä voittajaa.
        </p>
      </header>

      <form action="/compare" method="get" className="card flex flex-wrap items-end gap-2">
        <input type="hidden" name="mode" value={mode} />
        {["a", "b", "c", "d", "e"].map((k, i) => (
          <label key={k} className={i > 1 ? "hidden w-56 sm:block" : "w-56"}>
            <span className="label">{mode === "journalists" ? `Toimittaja ${["A", "B", "C", "D", "E"][i]}` : `Media ${["A", "B", "C", "D", "E"][i]}`}</span>
            <input name={k} className="input" placeholder="nimi tai URL" />
          </label>
        ))}
        <button type="submit" className="btn-primary">Vertaa</button>
        <a href="/compare" className="btn">Tavallinen vertailu</a>
      </form>

      {items.length === 0 && (
        <p className="text-sm text-ink-500">
          {mode === "journalists"
            ? "Anna 2–5 toimittajan nimi vertailua varten (esim. Mikael Shepelenko)."
            : "Anna 2–5 median nimeä vertailua varten (esim. Iltalehti, Yle)."}
        </p>
      )}

      {items.length > 0 && (
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-ink-500">Mittari</th>
                {items.map((it) => (
                  <th key={it.entity.id} className="px-3 py-2 text-left font-semibold">
                    <a
                      className="flex items-center gap-2 hover:text-accent"
                      href={entityUrlFor(it.entity.id, it.entity.type as never, it.entity.name, it.entity.subtype)}
                    >
                      <Avatar name={it.entity.name} type={it.entity.type as never} size={22} />
                      <span className="max-w-[160px] truncate">{it.entity.name}</span>
                    </a>
                    <span className="block text-[10px] font-normal text-ink-300">
                      {mode === "journalists" ? journalistSubtypeLabel(it.entity.subtype) : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CellRow label="Artikkeleita korpuksessa" values={items.map((it) => String(it.corpusSize))} />
              <CellRow label="Politiikka-aiheisia" values={items.map((it) => String(it.politicsArticleCount))} />
              <CellRow label="Aikaväli" values={items.map((it) => `${it.period.start ?? "?"} – ${it.period.end ?? "nykyhetki"}`)} />
              <tr className="border-t border-ink-100/60">
                <td className="py-2 pr-4 align-top font-medium text-ink-700">Puolueiden käsittely</td>
                {items.map((it) => (
                  <td key={it.entity.id} className="px-3 py-2 align-top">
                    <ul className="space-y-0.5">
                      {it.parties.slice(0, 6).map((p) => (
                        <li key={p.key} className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-ink-800">{p.name}</span>
                          <span className="tabular-nums text-ink-400">{p.shareOfPoliticsPct} %</span>
                        </li>
                      ))}
                      {it.parties.length === 0 && <li className="text-xs text-ink-300">—</li>}
                    </ul>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-ink-100/60">
                <td className="py-2 pr-4 align-top font-medium text-ink-700">Juttutyypit</td>
                {items.map((it) => (
                  <td key={it.entity.id} className="px-3 py-2 align-top">
                    <ul className="space-y-0.5">
                      {it.genres.map((g) => (
                        <li key={g.key} className="flex justify-between gap-2 text-xs">
                          <span className="text-ink-800">{genreLabel(g.key as never)}</span>
                          <span className="tabular-nums text-ink-400">{g.count}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-ink-100/60">
                <td className="py-2 pr-4 align-top font-medium text-ink-700">Top-aiheet</td>
                {items.map((it) => (
                  <td key={it.entity.id} className="px-3 py-2 align-top">
                    <p className="text-xs leading-relaxed text-ink-500">
                      {it.topics.slice(0, 5).map((t) => t.name).join(", ") || "—"}
                    </p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-2 px-1 pb-1 text-[11px] text-ink-400">
            Jakaumat ovat data-analyysia (◐) avoimesta korpuksesta. Ne eivät osoita toimittajan henkilökohtaista
            poliittista mielipidettä eivätkä vertailun “voittajaa”.
          </p>
        </section>
      )}
    </div>
  );
}

function CellRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-ink-100/60">
      <td className="py-2 pr-4 font-medium text-ink-700">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2 tabular-nums text-ink-800">{v}</td>
      ))}
    </tr>
  );
}