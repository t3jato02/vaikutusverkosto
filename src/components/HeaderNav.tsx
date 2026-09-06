"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CommandPalette from "@/components/CommandPalette";

const NAV = [
  { href: "/explore", label: "Tutki" },
  { href: "/media", label: "Media" },
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <CommandPalette />
      <div className="mx-auto flex w-full max-w-content items-center gap-3 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          className="btn-ghost -ml-1 p-1.5 lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Sulje valikko" : "Avaa valikko"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Vaikutusverkosto — etusivu">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-bold text-white">V</span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">Vaikutusverkosto</span>
        </Link>

        <nav aria-label="Päänavigaatio" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-link" aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="hidden items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-300 transition hover:border-ink-300 hover:text-muted sm:flex"
            aria-label="Hae henkilöä, organisaatiota tai päätöstä (Cmd/Ctrl+K)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="hidden md:inline">Hae henkilöä, organisaatiota…</span>
            <kbd className="hidden rounded border border-line bg-paper px-1 text-[10px] font-medium text-ink-300 md:inline">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="btn-ghost p-1.5 sm:hidden"
            aria-label="Hae"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
          {admin ? (
            <Link href="/admin" className="hidden text-[13px] font-medium text-muted hover:text-accent sm:inline-block">
              Ylläpito
            </Link>
          ) : (
            <Link href="/login" className="hidden text-[13px] text-ink-300 hover:text-ink sm:inline-block">
              Kirjaudu
            </Link>
          )}
        </div>
      </div>

      {open && (
        <nav aria-label="Mobiilivalikko" className="border-t border-line bg-surface px-2 py-1 lg:hidden">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink-100"
                  aria-current={isActive(n.href) ? "page" : undefined}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <Link
                href={admin ? "/admin" : "/login"}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted hover:bg-ink-100"
              >
                {admin ? "Ylläpito" : "Kirjaudu"}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
