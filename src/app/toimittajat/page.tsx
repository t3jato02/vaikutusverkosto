import type { Metadata } from "next";
import Link from "next/link";
import { listJournalists, listMediaOutlets } from "@/lib/mediaQueries";
import { journalistSubtypeLabel } from "@/lib/journalism";
import { entityUrlFor } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { TrustLegend } from "@/components/journalism/TrustLayer";

export const metadata: Metadata = {
  title: "Toimittajat",
  description: "Suomalaiset toimittajat dokumentoituine työnantajineen, erikoisaloineen ja julkisine tuotantoineen.",
};
export const dynamic = "force-dynamic";

export default async function JournalistsPage({
  searchParams,
}: {
  searchParams: Promise<{ media?: string; role?: string; q?: string }>;
}) {
  const { media, role, q } = await searchParams;
  const [journalists, outlets] = await Promise.all([listJournalists({ mediaSlug: media, role, q }), listMediaOutlets({})]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Toimittajat</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Julkisesti tunnistettavia politiikan, ulkomaiden ja yhteiskunnan toimittajia. Jokainen tieto on
          lähdeperusteista; listaus ei ole arvio henkilön kannasta. Artikkelimäärät ovat havaittua julkaisudataa.
        </p>
      </header>

      <form action="/toimittajat" method="get" className="card flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">Nimi</span>
          <input name="q" defaultValue={q ?? ""} className="input" placeholder="Esim. shepelenko" />
        </label>
        <label className="w-56">
          <span className="label">Media</span>
          <select name="media" defaultValue={media ?? ""} className="input">
            <option value="">Kaikki mediat</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-56">
          <span className="label">Rooli</span>
          <select name="role" defaultValue={role ?? ""} className="input">
            <option value="">Kaikki roolit</option>
            {["JOURNALIST", "POLITICS_REPORTER", "FOREIGN_REPORTER", "INVESTIGATIVE_REPORTER", "EDITOR_IN_CHIEF", "EDITOR", "COLUMNIST", "FREELANCER", "COMMENTATOR"].map((r) => (
              <option key={r} value={r}>
                {journalistSubtypeLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">Suodata</button>
        <Link href="/toimittajat" className="btn">Tyhjennä</Link>
      </form>

      <section aria-label="Toimittajalistaus">
        <h2 className="card-title mb-2">TOIMITTAJAT ({journalists.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {journalists.length === 0 && <li className="py-4 text-sm text-ink-500">Ei toimittajia haulla.</li>}
          {journalists.map((j) => (
            <li key={j.id}>
              <Link
                href={entityUrlFor(j.id, "PERSON", j.name, j.subtype)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-ink-100/50"
              >
                <Avatar name={j.name} type="PERSON" size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{j.name}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {journalistSubtypeLabel(j.subtype)}
                    {j.employerName ? ` · ${j.employerName}` : ""}
                    {j.currentRole ? ` · ${j.currentRole}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{j.articleCount}</span>
                  <span className="text-[10px] uppercase text-ink-300">juttua</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <TrustLegend />
    </div>
  );
}