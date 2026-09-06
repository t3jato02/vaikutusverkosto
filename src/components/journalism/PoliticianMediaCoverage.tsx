import Link from "next/link";
import { politicianMediaSummary } from "@/lib/mediaQueries";
import { entityUrlFor } from "@/lib/queries";
import { genreLabel } from "@/lib/journalism";
import { formatDate } from "@/lib/format";
import { ContentAnalysisDisclaimer } from "./TrustLayer";

/**
 * Politician's "Media & toimittajat" (section 8). This is OBSERVABLE
 * publication data — who has mentioned this person in the corpus — not a claim
 * about a personal or professional relationship.
 */
export default async function PoliticianMediaCoverage({ personEntityId }: { personEntityId: string }) {
  const summary = await politicianMediaSummary(personEntityId);
  if (summary.totalMentioningArticles === 0) return null;

  return (
    <section aria-label="Media ja toimittajat">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Media & toimittajat</h2>
        <span className="meta">{summary.totalMentioningArticles} havainnoitua juttua korpuksessa</span>
      </div>
      <p className="mb-2 text-xs text-ink-500">
        Ketkä toimittajat ovat käsitelleet tätä henkilöä käytettävissä olevassa avoimessa korpuksessa. Tämä on
        havaittua julkaisudataa, ei väite henkilösuhteesta tai kannasta.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="card-title mb-2">TOIMITTAJAT, JOTKA OVAT KÄSITELLEET</h3>
          <ul className="card divide-y divide-ink-100">
            {summary.journalists.length === 0 && <li className="py-3 text-sm text-ink-500">Ei tunnistettuja kirjoittajia korpuksessa.</li>}
            {summary.journalists.map((j) => (
              <li key={j.journalistId} className="flex items-center justify-between gap-2 py-2.5">
                <Link
                  href={entityUrlFor(j.journalistId, "PERSON", j.name, undefined)}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-accent hover:underline"
                >
                  {j.name}
                </Link>
                <span className="shrink-0 text-[11px] text-ink-400">{j.outlets.join(", ")}</span>
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{j.articleCount}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="card-title mb-2">VIIMEISIMMÄT JUTUT</h3>
          <ul className="card divide-y divide-ink-100">
            {summary.articles.slice(0, 12).map((a) => (
              <li key={a.id} className="py-2.5">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink-900 hover:text-accent">
                  {a.title}
                </a>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {a.outlet ?? ""} · {genreLabel(a.genre)} · {formatDate(a.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <ContentAnalysisDisclaimer compact />
      </div>
    </section>
  );
}