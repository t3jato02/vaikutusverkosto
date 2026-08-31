import Link from "next/link";
import { isAdminSession } from "@/lib/auth";

const NAV = [
  { href: "/explore", label: "Tutki" },
  { href: "/money", label: "Raha" },
  { href: "/decisions", label: "Päätökset" },
  { href: "/map", label: "Kartta" },
  { href: "/changes", label: "Muutokset" },
  { href: "/methodology", label: "Menetelmät" },
];

export const dynamic = "force-dynamic";

export default async function Header() {
  const admin = await isAdminSession();
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded bg-ink-900 text-xs font-bold text-white">
              V
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Vaikutusverkosto
            </span>
          </Link>
          <nav aria-label="Päänavigaatio" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link">
                {n.label}
              </Link>
            ))}
            <Link href="/sources" className="nav-link">
              Lähteet
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/search" className="btn text-sm">
            Haku
          </Link>
          {admin ? (
            <Link href="/admin" className="btn text-sm" aria-label="Ylläpito">
              Ylläpito
            </Link>
          ) : (
            <Link href="/login" className="nav-link text-sm" aria-label="Kirjaudu">
              Kirjaudu
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}