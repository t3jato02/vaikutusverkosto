"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Result {
  id: string;
  canonicalName: string;
  type: string;
  label: string;
  url: string;
  subtitle: string;
  sourceCount: number;
}

const GROUPS: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: "person", label: "Henkilöt", match: (t) => t === "PERSON" },
  {
    key: "org",
    label: "Organisaatiot",
    match: (t) =>
      ["ORGANIZATION", "COMPANY", "GOVERNMENT_BODY", "POLITICAL_PARTY", "ASSOCIATION", "FOUNDATION", "UNION", "MEDIA_ORGANIZATION", "EDUCATIONAL_INSTITUTION", "COURT", "PUBLIC_AUTHORITY", "PENSION_INSTITUTION"].includes(t),
  },
  { key: "decision", label: "Päätökset", match: (t) => t === "DECISION" },
  { key: "project", label: "Projektit", match: (t) => t === "PROJECT" || t === "CAMPAIGN" },
  { key: "money", label: "Rahavirrat", match: (t) => t === "MONEY" },
  { key: "other", label: "Muut", match: () => true },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
    restoreFocus.current?.focus?.();
  }, []);

  // Cmd/Ctrl+K toggles; a custom event lets the header search button open it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        restoreFocus.current = document.activeElement as HTMLElement;
        setOpen((v) => !v);
      }
    };
    const onOpen = () => {
      restoreFocus.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Debounced, abortable search.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`, { signal: ac.signal });
        const data = await res.json();
        setResults((data.results ?? []) as Result[]);
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const grouped = useMemo(() => {
    const seen = new Set<string>();
    const out: { group: string; items: Result[] }[] = [];
    for (const g of GROUPS) {
      const items = results.filter((r) => !seen.has(r.id) && g.match(r.type));
      items.forEach((r) => seen.add(r.id));
      if (items.length) out.push({ group: g.label, items });
    }
    return out;
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const go = useCallback(
    (r: Result | undefined) => {
      if (!r) return;
      close();
      router.push(r.url);
    },
    [close, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Tab") {
      // trivial focus trap: keep focus in the input
      e.preventDefault();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-ink-900/30" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Haku"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-300" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hae henkilöä, organisaatiota, päätöstä tai projektia"
            aria-label="Hakusana"
            className="w-full bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-300"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="shrink-0 text-xs text-ink-300">…</span>}
          <kbd className="shrink-0 rounded border border-line bg-paper px-1 text-[10px] text-ink-300">Esc</kbd>
        </div>

        <div ref={listRef as never} className="max-h-[min(60vh,26rem)] overflow-y-auto">
          <ul>
            {q.trim().length >= 2 && !loading && flat.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Ei tuloksia haulle &ldquo;{q}&rdquo;.</li>
            )}
            {q.trim().length < 2 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Kirjoita vähintään kaksi merkkiä.</li>
            )}
            {grouped.map((g) => (
              <li key={g.group}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-300">
                  {g.group}
                </div>
                <ul>
                  {g.items.map((r) => {
                    const idx = flat.indexOf(r);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(r)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                            idx === active ? "bg-accent-soft" : "hover:bg-ink-100"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{r.canonicalName}</span>
                            {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                          </span>
                          <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {r.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-ink-300">
          <span>↑ ↓ liiku · ↵ avaa · Esc sulje</span>
          <a href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} className="text-accent hover:underline" onClick={close}>
            Koko haku →
          </a>
        </div>
      </div>
    </div>
  );
}
