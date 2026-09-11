import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Vaikuta — menetelmät" };
export const dynamic = "force-dynamic";

export default function VaikutaMethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Vaikuta — menetelmät</h1>
        <p className="mt-1 text-sm text-ink-500">
          Miten vastaanottajat valitaan, miten AI-avustaja toimii ja miten turvallisuus on varmistettu.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="card-title">Vastaanottajien valinta — lähdepohjainen relevanssi</h2>
        <p className="text-sm leading-relaxed text-ink-700">
          Jokainen vastaanottajaehdotus johdetaan dokumentoiduista institutionaalisista suhteista:
          valiokunnan jäsenyys, äänestyksen osallistuminen, puheenjohtajuus, ministerivastuu,
          täysistunto-osallisuus, aloitteen tekijyys tai asiasta dokumentoitu raportointi.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Ei rankata henkilöitä ideologian mukaan.</li>
          <li>Ilman lähdepohjaista perustetta oleva vastaanottaja ei ole automaattisuosituksessa.</li>
          <li>Viestissä näytetään aina perustelu (“Miksi relevantti”), lähde ja vahvistusajankohta.</li>
          <li>Toimittajat on erotettu päätöksentekijöistä: raportointi ei tarkoita roolia päätöksenteossa.</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">AI-avustaja — ei muuta kantaasi</h2>
        <p className="text-sm leading-relaxed text-ink-700">
          Avustaja on <strong>sääntöpohjainen ja paikallinen</strong>. Se selkeyttää, lyhentää,
          muodollistaa, kehystää kysymykseksi ja lisää päätöksen dokumentoidut lähteet.
          Se ei keksi argumentteja tai väitteitä (tarvittaessa katsot “Tarkista väittämät”-näkymän).
          Sinä hyväksyt lopullisen tekstin ennen mitään jatkotoimia.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Turvallisuus ja vastuullisuus</h2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Yksi käyttäjä → yksi kampanja → normaalisti yksi viesti vastaanottajaa kohti päätöstä kohti.</li>
          <li>Kohtuullisuusrajat, kaksoiskappaleiden esto ja yhden vastaanottajan ylikuormituksen esto.</li>
          <li>Epäilyttävät sisällöt (uhkailu, häirintä, doxxaus, kalastelu, esiintyminen toisena) estetään tai ohjataan tarkistukseen.</li>
          <li>Poliittinen erimielisyys, kritiikki ja vahvat mielipiteet eivät itsessään ole väärinkäyttöä.</li>
        </ul>
        <Link href="/vaikuta/responsible-use" className="text-[13px] text-accent hover:underline">
          Lue lisää vastuullisesta käytöstä →
        </Link>
      </section>

      <section className="card space-y-2">
        <h2 className="card-title">Prototyyppi &amp; maksu- / toimitusvalmius</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Prototyyppi simuloi kassan, maksun ja toimituksen. Se <strong>ei</strong> veloita ja{" "}
          <strong>ei</strong> lähetä viestejä. Oikea maksu ja oikea ulkoinen toimitus vaativat
          erikseen nimenomaisen ympäristöasetuksen muutoksen ja lainmukaisuustarkistuksen.
        </p>
      </section>
    </div>
  );
}