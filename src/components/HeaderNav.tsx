"use client";

import Link from "next/link";
import { useState } from "react";

const NAV = [
  { href: "/explore", label: "Tutki" },
  { href: "/money", label: "Raha" },
  { href: "/foreign", label: "Kv-yhteydet" },
  { href: "/analytics", label: "Analyysi" },
  { href: "/decisions", label: "Päätökset" },
  { href: "/map", label: "Kartta" },
  { href: "/changes", label: "Muutokset" },
  { href: "/sources", label: "Lähteet" },
  { href: "/methodology", label: "Menetelmät" },
];

export default function HeaderNav({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded border border-ink-100 p-1.5 text-ink-700 hover:bg-ink-100 lg:hidden"
            aria-expanded={open}
            aria-label="Avaa valikko"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded bg-ink-900 text-xs font-bold text-white">
              V
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Vaikutusverkosto
            </span>
          </Link>
          <nav aria-label="Päänavigaatio" className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/search" className="btn text-sm">
            Haku
          </Link>
          {admin ? (
            <Link href="/admin" className="hidden text-sm font-medium text-ink-700 hover:text-accent sm:inline-block" aria-label="Ylläpito">
              Ylläpito
            </Link>
          ) : (
            <Link href="/login" className="hidden text-sm text-ink-500 hover:text-ink-900 sm:inline-block" aria-label="Kirjaudu">
              Kirjaudu
            </Link>
          )}
        </div>
      </div>
      {open && (
        <nav aria-label="Mobiilivalikko" className="border-t border-ink-100 bg-white px-4 py-2 lg:hidden">
          <ul className="divide-y divide-ink-100">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block px-2 py-2.5 text-sm font-medium text-ink-900 hover:text-accent" onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              {admin ? (
                <Link href="/admin" className="block px-2 py-2.5 text-sm font-medium text-ink-700 hover:text-accent" onClick={() => setOpen(false)}>
                  Ylläpito
                </Link>
              ) : (
                <Link href="/login" className="block px-2 py-2.5 text-sm font-medium text-ink-500" onClick={() => setOpen(false)}>
                  Kirjaudu
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}