import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { entityUrlFor } from "@/lib/queries";
import { relationshipLabel } from "@/lib/constants";
import { relationshipPhrase, temporalLabel, verificationLabel } from "@/lib/labels";
import { formatDateLong } from "@/lib/format";
import CandidateReviewPanel, { type ReviewCandidate } from "@/components/admin/CandidateReviewPanel";
import type { RelationshipType } from "@prisma/client";

/** Build the rich per-candidate context the review panel renders. */
async function buildReviewCandidates(
  rows: Awaited<ReturnType<typeof db.relationshipCandidate.findMany>>,
): Promise<ReviewCandidate[]> {
  const entityIds = [
    ...new Set(rows.flatMap((c) => [c.resolvedSourceEntityId, c.resolvedTargetEntityId].filter(Boolean) as string[])),
  ];
  const entities = entityIds.length
    ? await db.entity.findMany({ where: { id: { in: entityIds } }, select: { id: true, canonicalName: true } })
    : [];
  const nameOf = new Map(entities.map((e) => [e.id, e.canonicalName]));

  // Existing relationships between any candidate pair (both directions).
  const pairs = rows
    .filter((c) => c.resolvedSourceEntityId && c.resolvedTargetEntityId)
    .map((c) => [c.resolvedSourceEntityId!, c.resolvedTargetEntityId!] as const);
  const existingRels = pairs.length
    ? await db.relationship.findMany({
        where: {
          OR: pairs.flatMap(([a, b]) => [
            { sourceEntityId: a, targetEntityId: b },
            { sourceEntityId: b, targetEntityId: a },
          ]),
        },
        select: {
          sourceEntityId: true,
          targetEntityId: true,
          relationshipType: true,
          temporalState: true,
          verificationStatus: true,
          verificationState: true,
        },
      })
    : [];

  return rows.map((c): ReviewCandidate => {
    const srcRef = c.sourceEntityRef as { name?: string } | null;
    const tgtRef = c.targetEntityRef as { name?: string } | null;
    const sName = (c.resolvedSourceEntityId && nameOf.get(c.resolvedSourceEntityId)) || srcRef?.name || "?";
    const tName = (c.resolvedTargetEntityId && nameOf.get(c.resolvedTargetEntityId)) || tgtRef?.name || "?";
    const bothResolved = Boolean(c.resolvedSourceEntityId && c.resolvedTargetEntityId);
    const between = existingRels.filter(
      (r) =>
        (r.sourceEntityId === c.resolvedSourceEntityId && r.targetEntityId === c.resolvedTargetEntityId) ||
        (r.sourceEntityId === c.resolvedTargetEntityId && r.targetEntityId === c.resolvedSourceEntityId),
    );
    const duplicate = between.some((r) => r.relationshipType === c.relationshipType && r.verificationState === "PUBLISHED");
    const conflict = between.some((r) => r.verificationStatus === "DISPUTED");
    return {
      id: c.id,
      sourceName: sName,
      targetName: tName,
      relationshipLabel: relationshipPhrase(c.relationshipType, "out"),
      relationshipType: c.relationshipType,
      role: c.role,
      confidenceScore: c.confidenceScore,
      extractionMethod: c.extractionMethod,
      extractorVersion: c.extractorVersion,
      sourceLabel: `${c.sourceName} · ${c.publisher}`,
      evidenceUrl: c.evidenceUrl,
      evidenceTitle: c.evidenceTitle,
      bothResolved,
      duplicate,
      conflict,
      existing: between.map((r) => ({
        label: relationshipPhrase(r.relationshipType as RelationshipType, "out"),
        temporal: temporalLabel(r.temporalState),
        verification: verificationLabel(r.verificationStatus).label,
      })),
      groupKey: `${c.sourceName} · ${c.relationshipType} · ${c.extractionMethod}${c.extractorVersion ? ` ${c.extractorVersion}` : ""}`,
      batchSafe: c.extractionMethod === "deterministic-parser" && bothResolved && !duplicate && !conflict,
    };
  });
}

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
  const [candidates, relCandidates, autoRels, disputed, corrections, audit, affiliations] = await Promise.all([
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
    db.politicalAffiliation.findMany({
      where: { reviewStatus: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: {
        personEntity: { select: { id: true, canonicalName: true } },
        partyEntity: { select: { id: true, canonicalName: true } },
      },
    }),
  ]);
  const conflicts = await db.sourceConflict.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 30 });
  const reviewCandidates = await buildReviewCandidates(relCandidates);

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
          julkaistuiksi suhteiksi. Hyväksyntä luo suhteen tilassa HUMAN_VERIFIED. Ryhmähyväksyntä
          on sallittu vain ryhmille, joissa jokainen ehdokas täyttää täsmälleen samat
          deterministiset ehdot (parseri, entiteetit ratkaistu, ei duplikaattia, ei konfliktia).
        </p>
        <CandidateReviewPanel candidates={reviewCandidates} />
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

      {conflicts.length > 0 && (
        <section aria-label="Lähderistiriidat">
          <h2 className="card-title mb-2">LÄHDERISTIRIIDAT ({conflicts.length})</h2>
          <ul className="card divide-y divide-ink-100">
            {conflicts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-ink-900">{c.kind}</span>
                  <p className="text-ink-400">
                    A: {(c.claimA as { text?: string })?.text} · B: {(c.claimB as { text?: string })?.text}
                  </p>
                </div>
                <ActionForm
                  target="source_conflict"
                  id={c.id}
                  actions={[
                    { value: "resolve", label: "Ratkaistu" },
                    { value: "dismiss", label: "Ei ristiriitaa" },
                  ]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Poliittiset sidokset">
        <h2 className="card-title mb-2">POLIITTISET SIDOKSET ODOTTAA TARKISTUSTA ({affiliations.length})</h2>
        <p className="mb-2 text-[11px] text-ink-500">
          Vain tarkastaja voi julkaista puoluesidoksen (reviewStatus=PUBLISHED, verification=HUMAN_VERIFIED).
          Agentti ei voi laittaa näitä tilaan HUMAN_VERIFIED eikä sisältöanalyysi voi tuottaa näitä rivejä ollenkaan.
        </p>
        <ul className="card divide-y divide-ink-100">
          {affiliations.length === 0 && <li className="py-3 text-sm text-ink-500">Ei odottavia sidoksia.</li>}
          {affiliations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-ink-900">{a.personEntity.canonicalName}</span>
                <span className="text-ink-500"> · {a.affiliationType}</span>
                {a.partyEntity ? <span className="text-ink-500"> · {a.partyEntity.canonicalName}</span> : null}
                {a.role ? <span className="text-ink-500"> · {a.role}</span> : null}
                <p className="text-ink-400">
                  {a.startYear ?? "?"}–{a.endYear ?? "?"} · {a.selfReported ? "henkilön itsensä ilmoittama" : "dokumentoitu"} ·{" "}
                  <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">lähde</a> · {a.description.slice(0, 90)}
                </p>
              </div>
              <ActionForm
                target="affiliation"
                id={a.id}
                actions={[
                  { value: "approve", label: "Julkaise (HUMAN_VERIFIED)" },
                  { value: "dispute", label: "Riitauta" },
                  { value: "reject", label: "Hylkää" },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

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
