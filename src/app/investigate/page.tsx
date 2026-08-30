import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveShortId } from "@/lib/queries";
import { relationshipLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Selvitä yhteydet" };
export const dynamic = "force-dynamic";

async function resolveParam(slug: string) {
  const m = slug.match(/-([0-9a-f]{8})$/);
  if (m) {
    const full = await resolveShortId(m[1]);
    if (full) return db.entity.findUnique({ where: { id: full } });
  }
  return db.entity.findFirst({ where: { canonicalName: { equals: slug.replace(/-/g, " "), mode: "insensitive" as const } } });
}

interface Neighbor {
  otherId: string;
  relId: string;
  type: string;
  role: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

async function neighborsOf(id: string): Promise<Neighbor[]> {
  const rels = await db.relationship.findMany({
    where: { OR: [{ sourceEntityId: id }, { targetEntityId: id }] },
    select: {
      id: true,
      sourceEntityId: true,
      targetEntityId: true,
      relationshipType: true,
      role: true,
      startDate: true,
      endDate: true,
    },
    take: 600,
  });
  return rels.map((r) => ({
    otherId: r.sourceEntityId === id ? r.targetEntityId : r.sourceEntityId,
    relId: r.id,
    type: r.relationshipType,
    role: r.role,
    startDate: r.startDate,
    endDate: r.endDate,
  }));
}

// BFS up to depth 3, collect all documented paths.
async function findPaths(startId: string, endId: string, maxDepth = 3) {
  const paths: { nodes: string[]; rels: Neighbor[] }[] = [];
  const queue: { id: string; nodes: string[]; rels: Neighbor[] }[] = [{ id: startId, nodes: [startId], rels: [] }];
  const seen = new Set<string>([startId]);

  for (let depth = 0; depth < maxDepth; depth++) {
    const level = queue.splice(0);
    for (const cur of level) {
      const neighbors = await neighborsOf(cur.id);
      for (const nb of neighbors) {
        const nextNodes = [...cur.nodes, nb.otherId];
        const nextRels = [...cur.rels, nb];
        if (nb.otherId === endId) {
          paths.push({ nodes: nextNodes, rels: nextRels });
          continue;
        }
        if (!seen.has(nb.otherId)) {
          seen.add(nb.otherId);
          queue.push({ id: nb.otherId, nodes: nextNodes, rels: nextRels });
        }
      }
    }
  }
  return paths.slice(0, 20);
}

export default async function InvestigatePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const [ea, eb] = await Promise.all([
    a ? resolveParam(a) : Promise.resolve(null),
    b ? resolveParam(b) : Promise.resolve(null),
  ]);
  if ((a && !ea) || (b && !eb)) notFound();

  let paths: Awaited<ReturnType<typeof findPaths>> = [];
  let nodes: Record<string, { canonicalName: string; type: string }> = {};
  if (ea && eb && ea.id !== eb.id) {
    paths = await findPaths(ea.id, eb.id, 3);
    const allIds = new Set<string>([ea.id, eb.id]);
    paths.forEach((p) => p.nodes.forEach((n) => allIds.add(n)));
    const found = await db.entity.findMany({
      where: { id: { in: [...allIds] } },
      select: { id: true, canonicalName: true, type: true },
    });
    nodes = Object.fromEntries(found.map((n) => [n.id, n]));
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Selvitä yhteydet</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Etsi dokumentoidut polut kahden toimijan välillä. Jokainen polun osa on lähdeperustainen
          yhteys. Polun olemassaolo ei tarkoita väärinkäytöstä.
        </p>
      </header>

      <form className="card flex flex-col gap-3 sm:flex-row" action="/investigate" method="get">
        <input name="a" defaultValue={a ?? ""} placeholder="Toimija A (esim. henkilö)" className="input" />
        <input name="b" defaultValue={b ?? ""} placeholder="Toimija B (esim. organisaatio)" className="input" />
        <button className="btn-primary shrink-0" type="submit">Etsi polut</button>
      </form>

      {ea && eb && ea.id !== eb.id && (
        <section aria-label="Löydetyt polut">
          <h2 className="card-title mb-2">
            DOKUMENTOIDUT POLUT: {ea.canonicalName} → {eb.canonicalName}
          </h2>
          {paths.length === 0 && (
            <p className="card text-sm text-ink-500">
              Ei löytynyt dokumentoituja polkuja syvyydellä 3. Polku voi silti olla olemassa
              syvemmällä tai toistaiseksi dokumentoimattomana.
            </p>
          )}
          <div className="space-y-3">
            {paths.map((p, i) => (
              <div key={i} className="card">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {p.nodes.map((nid, j) => (
                    <span key={nid} className="flex items-center gap-2">
                      <span className="font-medium text-ink-900">
                        {nodes[nid]?.canonicalName ?? "?"}
                      </span>
                      {j < p.nodes.length - 1 && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-500">
                          <span className="rounded bg-ink-100 px-1.5 py-0.5">
                            {relationshipLabel(p.rels[j].type as never)} {p.rels[j].role ? `(${p.rels[j].role})` : ""}
                          </span>
                          <span aria-hidden>→</span>
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-ink-300">
                  Polku on lähdeperustainen verkostoyhteys — ei väite toiminnasta tai väärinkäytöksestä.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(!ea || !eb || ea.id === eb.id) && (
        <p className="text-sm text-ink-500">
          Anna kaksi eri toimijaa. Esimerkiksi kaksi henkilöä, joiden välisiä dokumentoituja
          yhteyksiä haluat nähdä.
        </p>
      )}
    </div>
  );
}