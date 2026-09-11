import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatEur } from "@/lib/format";
import { getDecisionRecipients, getDecisionMedia, groupRecipients } from "@/lib/vaikuta/relevance";
import { getVaikutaSession } from "@/lib/vaikuta/session";
import StartCampaignButton from "@/components/vaikuta/StartCampaignButton";
import { DIMENSION_LABELS } from "@/lib/vaikuta/relevance";

export const metadata: Metadata = { title: "Päätös" };
export const dynamic = "force-dynamic";

async function resolveDecision(slug: string) {
  const m = slug.match(/([0-9a-f]{8})$/i);
  const short = m?.[1];
  const direct = await db.decision.findUnique({ where: { id: slug } });
  if (direct) return direct;
  if (short) {
    const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Decision" WHERE id::text LIKE ${short.toLowerCase() + "%"} LIMIT 1`;
    if (rows[0]) return db.decision.findUnique({ where: { id: rows[0].id } });
  }
  return null;
}

export default async function DecisionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decision = await resolveDecision(slug);
  if (!decision) notFound();

  const [stages, session, [makers, media]] = await Promise.all([
    db.decisionStage.findMany({ where: { decisionId: decision.id }, include: { source: true }, orderBy: { sortOrder: "asc" } }),
    getVaikutaSession(),
    Promise.all([getDecisionRecipients(decision.id), getDecisionMedia(decision.id)]),
  ]);

  const institution = decision.institutionEntityId ? await db.entity.findUnique({ where: { id: decision.institutionEntityId } }) : null;
  const source = decision.sourceId ? await db.source.findUnique({ where: { id: decision.sourceId } }) : null;
  const groups = groupRecipients([...makers, ...media]);

  const nextOpportunity = stages.find((s) => s.stageType === "NEXT_OPPORTUNITY") ?? null;
  const futureStages = stages.filter((s) => s.date && new Date(s.date) >= new Date() && s.stageType !== "NEXT_OPPORTUNITY");

  return (
    <div className="space-y-8">
      <header className="card-pad">
        <p className="label">PÄÄTÖS</p>
        <h1 className="mt-1 text-page-title">{decision.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {institution?.canonicalName ?? "Instituutio ei tiedossa"}
          {decision.decisionType ? ` · ${decision.decisionType}` : ""}
          {decision.decisionDate ? ` · ${formatDate(decision.decisionDate)}` : ""}
          {decision.financialValue != null ? ` · ${formatEur(decision.financialValue)}` : ""}
        </p>
        {decision.description && <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-700">{decision.description}</p>}
        {(decision.affectedSectors.length > 0 || decision.legalBasis) && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
            {decision.affectedSectors.length > 0 && (
              <div>
                <dt className="inline text-ink-300">Vaikutusalueet: </dt>
                <dd className="inline">{decision.affectedSectors.join(", ")}</dd>
              </div>
            )}
            {decision.legalBasis && (
              <div>
                <dt className="inline text-ink-300">Oikeusperusta: </dt>
                <dd className="inline">{decision.legalBasis}</dd>
              </div>
            )}
          </dl>
        )}
      </header>

      <section className="card-pad border-accent/40" aria-label="Vaikuta-painike">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Vaikuta tähän päätökseen</h2>
            <p className="mt-1 max-w-xl text-[13px] text-muted">
              Löydä lähdepohjaiset vastaanottajat, kirjoita näkemyksesi ja näe koko työnkulku prototyyppinä.
            </p>
          </div>
          <StartCampaignButton decisionId={decision.id} emailVerified={session.user?.emailVerified ?? false} />
        </div>
      </section>

      <section aria-label="Päätöspolku">
        <h2 className="section-title mb-2">Päätöspolku</h2>
        {stages.length === 0 ? (
          <p className="card text-sm text-ink-500">Seuraava vaihe ei ole vielä vahvistettu.</p>
        ) : (
          <ol className="card divide-y divide-line">
            {stages.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${s.date && new Date(s.date) <= new Date() ? "bg-verified" : "bg-ink-300"}`} aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-ink-900">{s.label}</p>
                    {s.detail && <p className="text-[12px] text-muted">{s.detail}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-500">
                  <span>{s.date ? formatDate(s.date) : "—"}</span>
                  {s.source && (
                    <a href={s.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {(nextOpportunity || futureStages.length > 0) && (
          <p className="mt-3 rounded border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-ink-700">
            <strong className="font-medium text-accent-dark">Seuraava vaikuttamismahdollisuus:</strong>{" "}
            {nextOpportunity?.label ?? futureStages[0]?.label ?? "Ei tarkkaa ajankohtaa vahvistettu."}
          </p>
        )}
      </section>

      <section aria-label="Päätökseen liittyvät henkilöt">
        <h2 className="section-title mb-2">Päätökseen liittyvät henkilöt</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {groups.map((g) => (
            <span key={g.key} className="chip" data-selected="false">
              {g.label} <span className="tabular-nums">{g.count}</span>
              {g.isMedia ? " · toimitus" : ""}
            </span>
          ))}
        </div>
        <ul className="card divide-y divide-line">
          {[...makers, ...media].slice(0, 30).map((c) => (
            <li key={c.entityId} className="py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-ink-900">{c.name}</span>
                <span className="text-xs text-ink-500">{c.role}</span>
                {c.organizationName && <span className="text-xs text-ink-300">· {c.organizationName}</span>}
                {c.isMedia && (
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                    Media
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-muted">
                <strong className="font-medium">Miksi relevantti:</strong> {c.reasonText} ({DIMENSION_LABELS[c.dimension]})
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Lähde: <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{c.sourceName}</a>
                {c.verifiedAt ? ` · vahvistettu ${c.verifiedAt.toLocaleDateString("fi-FI")}` : ""} ·{" "}
                {c.contactAvailability === "verified" || c.contactAvailability === "public_professional"
                  ? "Julkinen ammatillinen kanava"
                  : "Yhteystietoa ei ole varmistettu"}
              </p>
            </li>
          ))}
          {makers.length + media.length === 0 && (
            <li className="py-3 text-sm text-ink-500">
              Ei dokumentoituja liittyviä henkilöitä vielä. Vastaanotetaan, kun verkostotieto täydentyy.
            </li>
          )}
        </ul>
      </section>

      <section aria-label="Lähteet">
        <h2 className="section-title mb-2">Lähteet</h2>
        <ul className="card divide-y divide-line">
          {source ? (
            <li className="flex items-center justify-between gap-3 py-2 text-xs">
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {source.sourceName}
              </a>
              <span className="shrink-0 text-ink-300">{source.publicationDate ? formatDate(source.publicationDate) : ""}</span>
            </li>
          ) : (
            <li className="py-2 text-xs text-ink-500">Ei erillistä lähdeasiakirjaa tässä kohtaa.</li>
          )}
        </ul>
      </section>
    </div>
  );
}