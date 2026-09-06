"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ReviewCandidate {
  id: string;
  sourceName: string;
  targetName: string;
  relationshipLabel: string;
  relationshipType: string;
  role: string | null;
  confidenceScore: number | null;
  extractionMethod: string;
  extractorVersion: string | null;
  sourceLabel: string;
  evidenceUrl: string;
  evidenceTitle: string | null;
  bothResolved: boolean;
  duplicate: boolean;
  conflict: boolean;
  existing: { label: string; temporal: string; verification: string }[];
  groupKey: string;
  batchSafe: boolean;
}

async function postAction(id: string, action: "approve" | "reject" | "dispute", note?: string) {
  const body = new FormData();
  body.set("target", "relationship_candidate");
  body.set("id", id);
  body.set("action", action);
  body.set("mode", "json");
  if (note) body.set("note", note);
  const res = await fetch("/api/admin/review", { method: "POST", body });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
}

export default function CandidateReviewPanel({ candidates: initial }: { candidates: ReviewCandidate[] }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const current = items[cursor];

  const groups = useMemo(() => {
    const m = new Map<string, ReviewCandidate[]>();
    for (const c of items) {
      if (!m.has(c.groupKey)) m.set(c.groupKey, []);
      m.get(c.groupKey)!.push(c);
    }
    return [...m.entries()];
  }, [items]);

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        const next = prev.filter((c) => c.id !== id);
        setCursor((cur) => Math.max(0, Math.min(cur, next.length - 1)));
        if (idx === -1) return prev;
        return next;
      });
      setDone((d) => d + 1);
    },
    [],
  );

  const act = useCallback(
    async (action: "approve" | "reject" | "dispute") => {
      if (!current || busy) return;
      setBusy(true);
      setErr(null);
      try {
        await postAction(current.id, action);
        remove(current.id);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, remove],
  );

  const approveGroup = useCallback(
    async (key: string) => {
      const group = items.filter((c) => c.groupKey === key && c.batchSafe);
      if (group.length === 0 || busy) return;
      if (!window.confirm(`Hyväksy ${group.length} deterministististä ehdokasta ryhmästä?\nJokainen: deterministinen parseri, entiteetit ratkaistu, ei duplikaattia, ei konfliktia.`)) return;
      setBusy(true);
      setErr(null);
      try {
        for (const c of group) {
          await postAction(c.id, "approve", "batch: identical deterministic safety conditions");
          remove(c.id);
        }
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [items, busy, remove],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      else if (e.key === "a") { e.preventDefault(); void act("approve"); }
      else if (e.key === "r") { e.preventDefault(); void act("reject"); }
      else if (e.key === "d") { e.preventDefault(); void act("dispute"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, items.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">
        Ei avoimia suhde-ehdokkaita. {done > 0 ? `Käsitelty ${done} tässä istunnossa.` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {items.length} avointa · käsitelty {done} · näppäimet: <kbd className="rounded bg-ink-100 px-1">J</kbd>/<kbd className="rounded bg-ink-100 px-1">K</kbd> selaa ·{" "}
          <kbd className="rounded bg-ink-100 px-1">A</kbd> hyväksy · <kbd className="rounded bg-ink-100 px-1">R</kbd> hylkää · <kbd className="rounded bg-ink-100 px-1">D</kbd> riitauta
        </span>
        {busy && <span className="text-accent">…</span>}
      </div>
      {err && <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{err}</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* LEFT — list */}
        <ul ref={listRef} className="card max-h-[70vh] divide-y divide-ink-100 overflow-auto">
          {items.map((c, i) => (
            <li key={c.id} data-idx={i}>
              <button
                type="button"
                onClick={() => setCursor(i)}
                className={`block w-full px-3 py-2 text-left text-xs ${i === cursor ? "bg-accent/10" : "hover:bg-ink-100/50"}`}
              >
                <span className="block truncate font-medium text-ink-900">
                  {c.sourceName} <span className="text-muted">{c.relationshipLabel}</span> {c.targetName}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded bg-ink-100 px-1 text-ink-500">{c.extractionMethod}</span>
                  {c.duplicate && <span className="rounded bg-amber-100 px-1 text-amber-700">duplikaatti?</span>}
                  {c.conflict && <span className="rounded bg-red-100 px-1 text-red-700">konflikti</span>}
                  {!c.bothResolved && <span className="rounded bg-amber-100 px-1 text-amber-700">ei ratkaistu</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* CENTER — detail */}
        <div className="card space-y-3 text-sm">
          {current && (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Ehdotettu suhde</div>
                <p className="mt-0.5 font-medium [overflow-wrap:anywhere]">
                  {current.sourceName} <span className="text-accent">{current.relationshipLabel}</span> {current.targetName}
                </p>
                {current.role && <p className="text-[12px] text-muted [overflow-wrap:anywhere]">{current.role}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <dt className="text-ink-300">Tyyppi</dt><dd>{current.relationshipType}</dd>
                <dt className="text-ink-300">Uuttomenetelmä</dt><dd>{current.extractionMethod}{current.extractorVersion ? ` · ${current.extractorVersion}` : ""}</dd>
                <dt className="text-ink-300">Luottamus</dt><dd>{current.confidenceScore ?? "—"}</dd>
                <dt className="text-ink-300">Entiteetit</dt><dd>{current.bothResolved ? "molemmat ratkaistu" : "ratkaisematta"}</dd>
              </dl>
              {(current.duplicate || current.conflict) && (
                <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  {current.duplicate && "Samantyyppinen julkaistu suhde on jo olemassa näiden välillä. "}
                  {current.conflict && "Avoin lähdekonflikti tälle suhteelle."}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={busy} onClick={() => act("approve")} className="btn-primary text-xs">Hyväksy (A)</button>
                <button type="button" disabled={busy} onClick={() => act("reject")} className="btn text-xs">Hylkää (R)</button>
                <button type="button" disabled={busy} onClick={() => act("dispute")} className="btn text-xs">Riitauta (D)</button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — source + existing context */}
        <div className="card space-y-3 text-[12px]">
          {current && (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Lähde</div>
                <p className="mt-0.5 [overflow-wrap:anywhere]">{current.sourceLabel}</p>
                {current.evidenceTitle && <p className="text-muted [overflow-wrap:anywhere]">{current.evidenceTitle}</p>}
                <a href={current.evidenceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Avaa lähde ↗</a>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Nykyiset yhteydet näiden välillä</div>
                {current.existing.length === 0 ? (
                  <p className="mt-0.5 text-muted">Ei aiempia yhteyksiä.</p>
                ) : (
                  <ul className="mt-0.5 space-y-1">
                    {current.existing.map((e, i) => (
                      <li key={i}>
                        {e.label} <span className="text-ink-300">· {e.temporal} · {e.verification}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Batching — only groups where every member meets identical deterministic safety conditions */}
      {groups.some(([, g]) => g.length > 1 && g.every((c) => c.batchSafe)) && (
        <div className="card space-y-1 text-[11px]">
          <div className="font-semibold text-ink-700">Ryhmähyväksyntä (vain täysin deterministiset ryhmät)</div>
          {groups
            .filter(([, g]) => g.length > 1 && g.every((c) => c.batchSafe))
            .map(([key, g]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted [overflow-wrap:anywhere]">{key} — {g.length} ehdokasta</span>
                <button type="button" disabled={busy} onClick={() => approveGroup(key)} className="btn px-2 py-0.5 text-[11px]">
                  Hyväksy ryhmä ({g.length})
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
