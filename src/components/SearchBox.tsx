"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface SearchSuggestion {
  id: string;
  canonicalName: string;
  type: string;
  label: string;
  url: string;
  subtitle: string;
  sourceCount: number;
}

export default function SearchBox({
  autoFocus,
  big,
  initialValue,
}: {
  autoFocus?: boolean;
  big?: boolean;
  initialValue?: string;
}) {
  const [q, setQ] = useState(initialValue ?? "");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = `/search?q=${encodeURIComponent(q)}`;
        }}
      >
        <label htmlFor="global-search" className="sr-only">
          Hae henkilöä, organisaatiota, kuntaa tai päätöstä
        </label>
        <input
          id="global-search"
          type="search"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          placeholder="Hae henkilöä, yritystä, organisaatiota, kuntaa tai päätöstä…"
          className={`input ${big ? "px-4 py-3 text-base" : ""}`}
        />
      </form>
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-ink-100 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={r.url}
                onClick={() => setOpen(false)}
                className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-ink-100"
              >
                <span>
                  <span className="block text-sm font-medium text-ink-900">{r.canonicalName}</span>
                  {r.subtitle && (
                    <span className="block truncate text-xs text-ink-500">{r.subtitle}</span>
                  )}
                </span>
                <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                  {r.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-300">…</span>
      )}
    </div>
  );
}