import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { entityUrlFor } from "@/lib/queries";
import { relationshipLabel } from "@/lib/constants";
import { formatDateLong } from "@/lib/format";

export const metadata: Metadata = { title: "Tarkistusjono" };
export const dynamic = "force-dynamic";

function ActionForm({
  target,
  id,
  actions,
  entityIds,
}: {
  target: string;
  id: string;
  actions: { value: string; label: string }[];
  entityIds?: string[];
}) {
  return (
    <form action="/api/admin/review" method="post" className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      {entityIds && entityIds.length > 0 && (
        <select name="entityId" className="input h-7 py-0 text-[11px]">
          {entityIds.map((e) => (
            <option key={e} value={e}>
              {e.slice(0, 8)}
            </option>
          ))}
        </select>
      )}
      {actions.map((a) => (
        <button key={a.value} name="action" value={a.value} className="btn px-2 py-0.5 text-[11px]">
          {a.label}
        </button>
      ))}
    </form>
  );
}

export default async function AdminReviewPage() {
  const [candidates, relCandidates, autoRels, disputed, corrections, audit] = await Promise.all([
    db.entityResolutionCandidate.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 }),
    db.relationshipCandidate.findMany({
      where: { status: { in: ["PENDING", "NEEDS_REVIEW", "AUTO_ACCEPTABLE"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.relationship.findMany({
      where: { verificationStatus: "AUTO_DETECTED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
        evidence: { include: { source: true }, take: 1 },
      },
    }),
    db.relationship.findMany({
      where: { verificationStatus: "DISPUTED" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        sourceEntity: { select: { id: true, canonicalName: true, type: true } },
        targetEntity: { select: { id: true, canonicalName: true, type: true } },
      },
    }),
    db.correction.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { entity: { select: { id: true, canonicalName: true, type: true } } },
    }),
    db.reviewAction.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tarkistusjono</h1>
        <Link href="/admin" className="btn text-xs">Takaisin</Link>
      </div>

      <section aria-label="Identiteettiehdokkaat">
        <h2 className="card-title mb-2">RATKAISEMATTOMAT IDENTITEETIT ({candidates.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {candidates.length === 0 && <li className="py-3 text-sm text-ink-500">Ei ratkaisemattomia identiteettejä.</li>}
          {candidates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div>
                <span className="font-semibold text-ink-900">{c.refName}</span>
                <span className="text-ink-500"> · {c.refType}{c.refJurisdiction ? ` · ${c.refJurisdiction}` : ""}</span>
                <p className="text-ink-400">{c.candidateEntityIds.length} mahdollista osumaa · {formatDateLong(c.createdAt)}</p>
              </div>
              <ActionForm
                target="candidate"
                id={c.id}
                entityIds={c.candidateEntityIds}
                actions={[
                  { value: "resolve", label: "Ratkaise valittuun" },
                  { value: "dismiss", label: "Hylkää" },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Suhde-ehdokkaat">
        <h2 className="card-title mb-2">SUHDE-EHDOKKAAT ({relCandidates.length})</h2>
        <p className="mb-2 text-[11px] text-ink-500">
          Ei-deterministiset tai toissijaiset lähteet päätyvät ehdokkaiksi eivätkä suoraan
          julkaistuiksi suhteiksi. Hyväksyntä luo suhteen tilassa HUMAN_VERIFIED.
        </p>
        <ul className="card divide-y divide-ink-100">
          {relCandidates.length === 0 && <li className="py-3 text-sm text-ink-500">Ei ehdokkaita.</li>}
          {relCandidates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-ink-900">
                  {(c.sourceEntityRef as { name?: string })?.name ?? c.resolvedSourceEntityId?.slice(0, 8)}
                </span>
                <span className="text-ink-500"> {relationshipLabel(c.relationshipType)} </span>
                <span className="font-semibold text-ink-900">
                  {(c.targetEntityRef as { name?: string })?.name ?? c.resolvedTargetEntityId?.slice(0, 8)}
                </span>
                <p className="text-ink-400">
                  {c.extractionMethod}
                  {c.extractorVersion ? ` ${c.extractorVersion}` : ""} · luottamus {c.confidenceScore ?? "?"} ·{" "}
                  <a href={c.evidenceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a> ·{" "}
                  {c.status}
                  {!c.resolvedSourceEntityId || !c.resolvedTargetEntityId ? " · entiteetit ratkaisematta" : ""}
                </p>
              </div>
              <ActionForm
                target="relationship_candidate"
                id={c.id}
                actions={[
                  { value: "approve", label: "Hyväksy → HUMAN_VERIFIED" },
                  { value: "reject", label: "Hylkää" },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Vahvistamattomat suhteet">
        <h2 className="card-title mb-2">VAHVISTAMATTOMAT SUHTEET · AUTO_DETECTED ({autoRels.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {autoRels.length === 0 && <li className="py-3 text-sm text-ink-500">Ei vahvistamattomia suhteita.</li>}
          {autoRels.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <Link href={entityUrlFor(r.sourceEntity.id, r.sourceEntity.type, r.sourceEntity.canonicalName)} className="font-medium text-accent hover:underline">
                  {r.sourceEntity.canonicalName}
                </Link>
                <span className="text-ink-500"> {relationshipLabel(r.relationshipType)} </span>
                <Link href={entityUrlFor(r.targetEntity.id, r.targetEntity.type, r.targetEntity.canonicalName)} className="font-medium text-accent hover:underline">
                  {r.targetEntity.canonicalName}
                </Link>
                <p className="text-ink-400">
                  luottamus {r.confidenceScore ?? "?"} · {r.createdBy}
                  {r.evidence[0]?.source && (
                    <> · <a href={r.evidence[0].source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a></>
                  )}
                </p>
              </div>
              <ActionForm
                target="relationship"
                id={r.id}
                actions={[
                  { value: "approve", label: "Hyväksy" },
                  { value: "reject", label: "Hylkää" },
                  { value: "dispute", label: "Riitauta" },
                  { value: "stale", label: "Vanhentunut" },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      {disputed.length > 0 && (
        <section aria-label="Riitautetut suhteet">
          <h2 className="card-title mb-2">RIITAUTETUT SUHTEET ({disputed.length})</h2>
          <ul className="card divide-y divide-ink-100">
            {disputed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span>
                  {r.sourceEntity.canonicalName} <span className="text-ink-500">{relationshipLabel(r.relationshipType)}</span> {r.targetEntity.canonicalName}
                </span>
                <ActionForm
                  target="relationship"
                  id={r.id}
                  actions={[
                    { value: "approve", label: "Vahvista" },
                    { value: "reject", label: "Hylkää" },
                    { value: "stale", label: "Vanhentunut" },
                  ]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Korjauspyynnöt">
        <h2 className="card-title mb-2">KORJAUSPYYNNÖT</h2>
        <ul className="card divide-y divide-ink-100">
          {corrections.length === 0 && <li className="py-3 text-sm text-ink-500">Ei korjauspyyntöjä.</li>}
          {corrections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{c.category}</span>{" "}
                <span className="text-ink-900">{c.description}</span>
                <span className="block text-ink-300">
                  {formatDateLong(c.createdAt)} · {c.status}
                  {c.entity && (
                    <Link href={entityUrlFor(c.entity.id, c.entity.type, c.entity.canonicalName)} className="ml-2 text-accent hover:underline">
                      {c.entity.canonicalName}
                    </Link>
                  )}
                </span>
              </div>
              <ActionForm
                target="correction"
                id={c.id}
                actions={[
                  { value: "investigate", label: "Tutki" },
                  { value: "resolve", label: "Hyväksy" },
                  { value: "dismiss", label: "Hylkää" },
                  { value: "dispute", label: "Riitauta" },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Toimenpidehistoria">
        <h2 className="card-title mb-2">TOIMENPIDEHISTORIA</h2>
        <ul className="card divide-y divide-ink-100">
          {audit.length === 0 && <li className="py-3 text-sm text-ink-500">Ei toimenpiteitä.</li>}
          {audit.map((a) => (
            <li key={a.id} className="py-2 text-[11px] text-ink-500">
              <span className="font-semibold text-ink-900">{a.actor}</span> · {a.action} · {a.targetType} #{a.targetId.slice(0, 8)} ·{" "}
              {formatDateLong(a.createdAt)}
              {a.note ? <span className="block text-ink-400">{a.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
