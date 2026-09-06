import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectDetail, resolveProjectBySlug, entityUrlFor } from "@/lib/queries";
import { fundingTypeLabel, flowLabel, countryLabel } from "@/lib/constants";
import { verificationLabel } from "@/lib/labels";
import { formatEur, formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await resolveProjectBySlug(slug);
  return {
    title: project?.name ?? "Hanke",
    description: project
      ? `Hanke: ${project.name} — dokumentoitu rahoitus, osapuolet ja lähteet.`
      : undefined,
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = await resolveProjectBySlug(slug);
  if (!resolved) notFound();
  const detail = await getProjectDetail(resolved.id);
  if (!detail) notFound();
  const { project, flows, totalDocumentedEur, years, parties } = detail;

  const funders = parties.filter((p) => p.role === "funder");
  const recipients = parties.filter((p) => p.role === "recipient");
  const byYear = years.map((y) => ({
    year: y,
    amount: flows.filter((f) => f.periodYear === y).reduce((s, f) => s + Number(f.amount ?? 0), 0),
  }));

  const facts: { label: string; value: string }[] = [
    { label: "Ohjelma", value: project.programme ?? "—" },
    {
      label: "Kesto",
      value:
        project.startDate || project.endDate
          ? `${project.startDate ? formatDateLong(project.startDate) : "?"} – ${project.endDate ? formatDateLong(project.endDate) : "?"}`
          : "—",
    },
    {
      label: "Sijainti",
      value:
        [project.municipality, project.locationRegion, project.locationCountry ? countryLabel(project.locationCountry) : null]
          .filter(Boolean)
          .join(", ") || "—",
    },
    { label: "Dokumentoitu rahoitus", value: formatEur(totalDocumentedEur) },
    { label: "Rahoitustietueita", value: String(flows.length) },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Hanke</p>
        <h1 className="mt-1 text-entity-title [overflow-wrap:anywhere]">{project.name}</h1>
        {project.description && project.description !== project.name && (
          <p className="mt-2 max-w-2xl text-sm text-muted [overflow-wrap:anywhere]">{project.description}</p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-muted sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-ink-300">{f.label}</dt>
              <dd className="font-medium text-ink-700 [overflow-wrap:anywhere]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-label="Osapuolet">
        <h2 className="section-title mb-2">Osapuolet</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Rahoittaja</div>
            {funders.length === 0 && <p className="text-sm text-muted">—</p>}
            <ul className="space-y-1">
              {funders.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={entityUrlFor(p.id, p.type, p.canonicalName)} className="font-medium text-accent hover:underline">
                    {p.canonicalName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Saaja</div>
            {recipients.length === 0 && <p className="text-sm text-muted">—</p>}
            <ul className="space-y-1">
              {recipients.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={entityUrlFor(p.id, p.type, p.canonicalName)} className="font-medium text-accent hover:underline">
                    {p.canonicalName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {byYear.length > 0 && (
        <section aria-label="Dokumentoitu rahoitus vuosittain">
          <h2 className="section-title mb-2">Dokumentoitu rahoitus vuosittain</h2>
          <ul className="card divide-y divide-line">
            {(() => {
              const max = Math.max(...byYear.map((y) => y.amount), 1);
              return byYear.map((y) => (
                <li key={y.year} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular-nums font-medium">{y.year}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatEur(y.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-line">
                    <div className="h-full rounded bg-accent" style={{ width: `${Math.round((y.amount / max) * 100)}%` }} />
                  </div>
                </li>
              ));
            })()}
          </ul>
        </section>
      )}

      <section aria-label="Rahoitustietueet">
        <h2 className="section-title mb-2">Rahoitustietueet ({flows.length})</h2>
        <ul className="card divide-y divide-line">
          {flows.length === 0 && <li className="py-3 text-sm text-muted">Ei dokumentoituja rahavirtoja.</li>}
          {flows.map((f) => (
            <li key={f.id} id={`flow-${f.id}`} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <Link href={entityUrlFor(f.payerEntity.id, f.payerEntity.type, f.payerEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.payerEntity.canonicalName}
                  </Link>
                  <span className="text-ink-300"> → </span>
                  <Link href={entityUrlFor(f.recipientEntity.id, f.recipientEntity.type, f.recipientEntity.canonicalName)} className="font-medium text-accent hover:underline">
                    {f.recipientEntity.canonicalName}
                  </Link>
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{formatEur(f.amount)} {f.currency}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted [overflow-wrap:anywhere]">
                {f.fundingType ? fundingTypeLabel(f.fundingType) : flowLabel(f.flowType)}
                {f.funderCountryCode ? ` · ${countryLabel(f.funderCountryCode)}` : ""}
                {f.periodYear ? ` · ${f.periodYear}` : ""} · {verificationLabel(f.verificationStatus).label}
                {" · "}
                {f.sourceCount === 1 ? "1 lähde" : `${f.sourceCount} lähdettä`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Mistä tieto tulee?">
        <h2 className="section-title mb-2">Mistä tieto tulee?</h2>
        <div className="card space-y-2 text-[12px] text-muted">
          {project.sourceIdentifier && (
            <p>
              <span className="text-ink-300">Lähdetunniste: </span>
              <span className="font-mono text-ink-700">{project.sourceIdentifier}</span>
            </p>
          )}
          {years.length > 0 && (
            <p>
              <span className="text-ink-300">Raportointivuodet: </span>
              <span className="text-ink-700">{years.join(", ")}</span>
            </p>
          )}
          <p>
            <span className="text-ink-300">Tietue päivitetty: </span>
            <span className="text-ink-700">{formatDateLong(project.updatedAt)}</span>
          </p>
          <ul className="space-y-1 pt-1">
            {[...new Map(flows.flatMap((f) => f.evidence).map((e) => [e.source.id, e.source])).values()].map((s) => (
              <li key={s.id}>
                <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {s.sourceName}
                </a>
                {s.publisher ? ` · ${s.publisher}` : ""}
                {s.retrievedAt ? ` · haettu ${formatDateLong(s.retrievedAt)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
