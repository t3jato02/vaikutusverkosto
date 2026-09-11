import type { Metadata } from "next";
import Link from "next/link";
import { getDecisionOr404, getVaikutaSession } from "@/lib/vaikuta/session";
import { Stepper } from "@/components/vaikuta/Stepper";
import StartCampaignButton from "@/components/vaikuta/StartCampaignButton";
import { formatDate, formatEur } from "@/lib/format";

export const metadata: Metadata = { title: "Päätös — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function VaikutaMatterPage({ params }: { params: Promise<{ decisionId: string }> }) {
  const { decisionId } = await params;
  const decision = await getDecisionOr404(decisionId);
  const session = await getVaikutaSession();

  const stages = decision.stages;
  const nextOpportunity = stages.find((s) => s.stageType === "NEXT_OPPORTUNITY") ?? null;
  const futureStages = stages.filter((s) => s.date && new Date(s.date) >= new Date() && s.stageType !== "NEXT_OPPORTUNITY");

  return (
    <div className="space-y-6">
      <Stepper current="matter" />

      <header>
        <Link href={`/decision/${decision.id}`} className="text-[12px] text-accent hover:underline">
          ← Päätöksen profiili
        </Link>
        <p className="label mt-3">VAIHE 1 · ASIA</p>
        <h1 className="mt-1 text-entity-title">{decision.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {decision.institutionEntity?.canonicalName ?? "Instituutio ei tiedossa"}
          {decision.decisionType ? ` · ${decision.decisionType}` : ""}
          {decision.decisionDate ? ` · ${formatDate(decision.decisionDate)}` : ""}
        </p>
      </header>

      <section className="card space-y-3" aria-label="Yhteenveto">
        <h2 className="card-title">NEUTRAALI YHTEENVETO</h2>
        <p className="text-[14px] leading-relaxed text-ink-700">
          {decision.description ?? "Kuvausta ei ole vielä tallennettu."}
        </p>
        {(decision.affectedSectors.length > 0 || decision.legalBasis) && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
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
            {decision.financialValue != null && (
              <div>
                <dt className="inline text-ink-300">Rahoitusarvo: </dt>
                <dd className="inline font-medium text-ink-700">{formatEur(decision.financialValue)}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section aria-label="Käsittelyvaihe">
        <h2 className="section-title mb-2">Käsittelyvaihe</h2>
        {stages.length === 0 ? (
          <p className="card text-sm text-ink-500">Seuraava vaihe ei ole vielä vahvistettu.</p>
        ) : (
          <ol className="card space-y-0 divide-y divide-line">
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

      <section aria-label="Lähdeasiakirjat">
        <h2 className="section-title mb-2">Lähdeasiakirjat</h2>
        <ul className="card divide-y divide-line">
          {decision.source && (
            <li className="flex items-center justify-between gap-3 py-2 text-xs">
              <a href={decision.source.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {decision.source.sourceName}
              </a>
              <span className="shrink-0 text-ink-300">{decision.source.publicationDate ? formatDate(decision.source.publicationDate) : ""}</span>
            </li>
          )}
          {!decision.source && <li className="py-2 text-xs text-ink-500">Ei erillistä lähdeasiakirjaa tässä kohtaa.</li>}
        </ul>
      </section>

      <section className="card-pad space-y-3 border-accent/40">
        <h2 className="section-title">Vaikuta tähän päätökseen</h2>
        <p className="text-[13px] text-muted">
          Valitse lähdepohjaiset vastaanottajat, kirjoita näkemyksesi ja etene prototyypin
          kassaan asti. Mikään ei veloita eikä lähetä viestejä.
        </p>
        <StartCampaignButton decisionId={decision.id} emailVerified={session.user?.emailVerified ?? false} />
      </section>
    </div>
  );
}