"use client";

import { useState } from "react";
import Link from "next/link";
import type { RelationshipType, VerificationStatus, TemporalState } from "@prisma/client";
import { relationshipPhrase, verificationLabel } from "@/lib/labels";
import { VerificationBadge, TemporalBadge } from "@/components/badges";
import Drawer from "@/components/Drawer";

export interface RelEvidence {
  quote: string | null;
  sourceName: string;
  sourceUrl: string;
  publisher: string | null;
  sourceTypeLabel: string;
  documentTitle: string | null;
  publishedAt: string | null;
  retrievedAt: string | null;
}

export interface RelRow {
  id: string;
  other: { id: string; name: string; href: string; typeLabel: string };
  direction: "out" | "in";
  relationshipType: RelationshipType;
  role: string | null;
  startLabel: string | null;
  endLabel: string | null; // null => ongoing
  temporalState: TemporalState;
  verificationStatus: VerificationStatus;
  evidence: RelEvidence | null;
}

function periodText(r: RelRow): string {
  if (!r.startLabel && !r.endLabel) return "Ajankohta epävarma";
  return `${r.startLabel ?? "?"} – ${r.endLabel ?? "nykyhetki"}`;
}

export default function RelationshipList({
  rows,
  initialCount = 25,
  emptyText = "Ei dokumentoituja yhteyksiä.",
}: {
  rows: RelRow[];
  initialCount?: number;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<RelRow | null>(null);

  if (rows.length === 0) {
    return <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">{emptyText}</p>;
  }

  const shown = expanded ? rows : rows.slice(0, initialCount);
  const hidden = rows.length - shown.length;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {/* header row (desktop) */}
        <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted sm:grid">
          <span>Toimija ja suhde</span>
          <span>Aikaväli</span>
          <span>Varmennus</span>
          <span className="sr-only">Lähde</span>
        </div>
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const phrase = relationshipPhrase(r.relationshipType, r.direction);
            return (
              <li
                key={r.id}
                className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 text-sm transition hover:bg-ink-100/50 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link
                      href={r.other.href}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {r.other.name}
                    </Link>
                    <span className="text-muted">·</span>
                    <span className="text-muted">{phrase}</span>
                    {r.role && r.role.toLowerCase() !== phrase.toLowerCase() && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-muted">{r.role}</span>
                    )}
                    <TemporalBadge state={r.temporalState} />
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-300">{r.other.typeLabel}</div>
                </div>

                <div className="text-[12px] tabular-nums text-muted sm:text-right">{periodText(r)}</div>

                <div className="sm:justify-self-end">
                  <VerificationBadge status={r.verificationStatus} variant="dot" />
                </div>

                <div className="sm:justify-self-end">
                  {r.evidence ? (
                    <button
                      type="button"
                      onClick={() => setActive(r)}
                      className="btn-ghost px-2 py-1 text-[12px] text-accent hover:text-accent-dark"
                    >
                      Näytä todiste
                    </button>
                  ) : (
                    <span className="text-[12px] text-ink-300">Ei lähdettä</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full border-t border-line px-4 py-2.5 text-[13px] font-medium text-accent hover:bg-accent-soft"
          >
            Näytä {hidden} muuta yhteyttä
          </button>
        )}
      </div>

      <Drawer
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? relationshipPhrase(active.relationshipType, active.direction) : ""}
      >
        {active && <EvidenceBody row={active} />}
      </Drawer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

function EvidenceBody({ row }: { row: RelRow }) {
  const v = verificationLabel(row.verificationStatus);
  const e = row.evidence!;
  return (
    <>
      <dl>
        <Field label="Yhteys">
          {relationshipPhrase(row.relationshipType, row.direction)} — {row.other.name}
        </Field>
        <Field label="Ajanjakso">{periodText(row)}</Field>
        <Field label="Tila">
          <span className="inline-flex items-center gap-1.5">
            <VerificationBadge status={row.verificationStatus} />
          </span>
          <p className="mt-1 text-[13px] text-muted">{v.description}</p>
        </Field>
        <Field label="Lähde">{e.sourceName}</Field>
        <Field label="Lähdetyyppi">{e.sourceTypeLabel}</Field>
        <Field label="Julkaisija">{e.publisher}</Field>
        <Field label="Dokumentti">{e.documentTitle}</Field>
        <Field label="Julkaistu">{e.publishedAt}</Field>
        <Field label="Haettu">{e.retrievedAt}</Field>
        {e.quote && (
          <Field label="Todiste">
            <blockquote className="border-l-2 border-accent/40 pl-3 text-[13px] italic text-muted">
              {e.quote}
            </blockquote>
          </Field>
        )}
      </dl>
      <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
        Avaa alkuperäinen lähde
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 17L17 7M17 7H8M17 7v9" />
        </svg>
      </a>
    </>
  );
}
