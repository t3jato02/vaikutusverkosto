import type { Metadata } from "next";
import { PricingTable } from "@/components/vaikuta/PricingTable";
import { PrototypeBanner } from "@/components/vaikuta/PrototypeBanner";

export const metadata: Metadata = { title: "Hinnat" };
export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Hinnat</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Hinnat ovat prototyyppitason konfiguraatio, ja kassassa veloitetaan aina simuloidusti.
          Hinta kattaa vastaanottajien etsinnän, päätöskartan, lähdepohjaisen relevanssin,
          AI-avustajan, seurannan ja kampanjan organisoinnin — <strong>ei massaviestittämistä</strong>.
        </p>
      </header>

      <PrototypeBanner />

      <PricingTable />

      <section aria-label="Käytön säännöt" className="card">
        <h2 className="card-title">Käytön säännöt</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Ei rajattomia viestintäkapasiteetteja missään tasossa — kohtuullinen käyttö pätee kaikkiin.</li>
          <li>Jokaiselle vastaanottajalle normaalisti yksi viesti päätöstä kohden.</li>
          <li>Organisaatiotason suunnitelmat vaativat myyntiä kontaktin kautta (transparency-aspectit huomioidaan).</li>
          <li>Vastaanottajat valitaan dokumentoiduista institutionaalisista suhteista — ei arvattujen poliittisten vakaumusten perusteella.</li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-500">
          Ennen mahdollista maksujen tai oikean viestinnän aktivointia tehdään erillinen suomalaisen / EU-oikeuden
          tarkastus (GDPR, sähköisen viestinnän säännöt, kuluttajansuoja, laskutus/alv, kansalaisvaikuttamisen ja
          Transparency-rekisterin näkökulmat). Tämä ohjelmistototeutus ei ole itsessään todiste lainmukaisuudesta.
        </p>
      </section>
    </div>
  );
}