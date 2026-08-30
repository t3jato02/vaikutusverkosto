import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tietoja" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tietoja</h1>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-ink-700">
        <p>
          <strong>Vaikutusverkosto</strong> on julkinen, lähdeperustainen selvitysalusta Suomen
          vaikutusvaltaverkostoista. Sen ydinkysymys on:
        </p>
        <blockquote className="border-l-2 border-accent pl-4 italic">
          Kenellä on valtaa, minkä tehtävän tai suhteen kautta, minkä instituution, asian, rahan,
          päätöksen tai henkilön yli — ja mikä julkinen todiste tukee suhdetta?
        </blockquote>
        <p>
          Alusta tekee näkyväksi ihmiset → tehtävät → organisaatiot → päätökset → rahan →
          yhteydet → todisteet. Verkosto ei ole tuomio; lähteet ovat todisteet.
        </p>
        <p>
          Emme ole syytöskoneisto. Emme laske &ldquo;kuka on korruptoitunut&rdquo;. Näytämme dokumentoidut
          yhteydet ja annamme jokaisen tutkia todisteita itse. Kun analytiikka havaitsee
          epätavallisen kuvion, se kuvataan neutraalisti: &ldquo;epätavallisen tiheä verkoston
          päällekkäisyys&rdquo;, &ldquo;keskittynyt hankintasuhde&rdquo;, &ldquo;suuri dokumentoitu rahavirta&rdquo;.
        </p>
      </section>
      <section className="card space-y-2 text-sm text-ink-700">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900">Kattavuus (vaihe A)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Eduskunta: kansanedustajat, eduskuntaryhmät/puolueet, valiokunnat ja tehtävät — Eduskunnan avoimesta datasta.</li>
          <li>Rahavirtamalli: rakennettu; demotiedot merkitty selvästi.</li>
          <li>Päätösmalli: rakennettu; valtiopäiväasiakirjojen käsittely käynnissä.</li>
        </ul>
        <p className="text-xs text-ink-500">
          Vaiheet B ja C (kunnat, hyvinvointialueet, yliopistot, tuomioistuimet, säätiöt, media,
          hankinnat) on kuvattu menetelmäsivulla ja rakennettu tietomalliin valmiiksi.
        </p>
      </section>
    </div>
  );
}