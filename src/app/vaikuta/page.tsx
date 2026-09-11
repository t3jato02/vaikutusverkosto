import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PricingTable } from "@/components/vaikuta/PricingTable";
import { PrototypeBanner } from "@/components/vaikuta/PrototypeBanner";

export const metadata: Metadata = {
  title: "Vaikuta — osallistu päätöksenteon valmisteluun",
  description: "Ymmärrä päätös. Löydä oikeat ihmiset. Kerro näkemyksesi. Vaikuta-työkalu yhdistää päätöskartan ja lähdepohjaisen tiedon kansalaisviestintään.",
};
export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: 1,
    title: "Ymmärrä päätös",
    desc: "Neutraali yhteenveto, käsittelyvaihe, tärkeät päivämäärät ja lähdeasiakirjat — ei tulkintoja.",
  },
  {
    n: 2,
    title: "Löydä oikeat vastaanottajat",
    desc: "Lähdepohjainen kartta: päätöksentekijät, valmistelu, valiokunta ja asiasta raportoinut toimitus.",
  },
  {
    n: 3,
    title: "Kerro näkemyksesi",
    desc: "Kirjoita omin sanoin. AI-avustaja selkeyttää ja liittää päätöksen lähteet — ilman kantasi muuttamista.",
  },
];

export default async function VaikutaLanding() {
  const decisions = await db.decision.findMany({
    orderBy: { decisionDate: "desc" },
    take: 6,
    select: { id: true, title: true, updatedAt: true, _count: { select: { campaigns: true } } },
  });

  return (
    <div className="space-y-10">
      <PrototypeBanner />

      <section className="card-pad">
        <p className="label">VAIKUTA</p>
        <h1 className="mt-2 max-w-3xl text-page-title">
          Ymmärrä päätös. Löydä oikeat ihmiset. Kerro näkemyksesi.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Vaikutusverkosto näyttää, ketkä osallistuvat päätöksen valmisteluun ja päätöksentekoon
          sekä mihin tieto perustuu. Vaikuta-työkalu auttaa muodostamaan asiallisen yhteydenoton
          oikeille vastaanottajille.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/decisions" className="btn-primary">
            Selaa päätöksiä
          </Link>
          <Link href="/vaikuta/pricing" className="btn">
            Hinnat
          </Link>
        </div>
      </section>

      <section aria-label="Näin se toimii">
        <h2 className="section-title mb-3">Näin se toimii</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <span className="text-2xl font-bold tabular-nums text-accent">{s.n}</span>
              <h3 className="mt-1 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Hinnat">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="section-title">Hinnat</h2>
          <Link href="/vaikuta/pricing" className="text-[12px] text-accent hover:underline">
            Katso hinnat ja ehdot →
          </Link>
        </div>
        <PricingTable />
      </section>

      <section aria-label="Päätökset joihin voi vaikuttaa" className={decisions.length === 0 ? "hidden" : ""}>
        <h2 className="section-title mb-3">Päätökset, joihin voit vaikuttaa</h2>
        <ul className="card divide-y divide-line">
          {decisions.map((d) => (
            <li key={d.id}>
              <Link href={`/decision/${d.id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 hover:bg-ink-100/50">
                <span className="text-sm font-medium text-ink-900">{d.title}</span>
                <span className="text-[11px] text-ink-300">{d._count.campaigns} kampanjaa</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted" aria-label="Vaikuta-alasivut">
        <Link href="/vaikuta/methodology" className="hover:text-ink hover:underline">Menetelmät</Link>
        <Link href="/vaikuta/responsible-use" className="hover:text-ink hover:underline">Vastuullinen käyttö</Link>
        <Link href="/vaikuta/terms" className="hover:text-ink hover:underline">Ehdot</Link>
        <Link href="/vaikuta/privacy" className="hover:text-ink hover:underline">Tietosuoja</Link>
      </nav>
    </div>
  );
}