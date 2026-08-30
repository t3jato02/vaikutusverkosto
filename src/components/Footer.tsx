import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Vaikutusverkosto — julkinen vaikutusvaltaverkoston selvitysalusta. Ei syytöskoneisto:
          verkosto näkyviin, lähteet todisteiksi.
        </p>
        <nav aria-label="Alatunniste" className="flex flex-wrap gap-4">
          <Link href="/methodology" className="hover:text-ink-900">Menetelmät</Link>
          <Link href="/sources" className="hover:text-ink-900">Lähteet</Link>
          <Link href="/about" className="hover:text-ink-900">Tietoja</Link>
          <Link href="/api" className="hover:text-ink-900">API</Link>
        </nav>
      </div>
    </footer>
  );
}