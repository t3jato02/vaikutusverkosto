import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ehdot" };
export const dynamic = "force-dynamic";

export default function VaikutaTermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Vaikuta — käyttöehdot</h1>
        <p className="mt-1 text-sm text-ink-500">Voimassa prototyyppivaiheessa.</p>
      </header>

      <section className="card space-y-3">
        <h2 className="card-title">Palvelun luonne</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Vaikuta on prototyyppi suomalaiseen kansalaisvaikuttamiseen tarkoitetusta työkalusta,
          joka yhdistää Vaikutusverkoston päätös- ja vaikuttajakartan omaan yhteydenottoosi.
          Palvelu ei lähetä viestejä eikä takaa yhteydenoton perillemenoa tai vastausta.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Vastuu</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Käyttäjän luomat viestit ovat käyttäjän vastuulla. Vaikutusverkosto ei ota kantaa sisältöihin
          eikä toimi käyttäjien puolesta vaikuttajana. Saatavuudesta, tietojen oikeellisuudesta ja
          oikeudellisesta hyväksyttävyydestä ei anneta takeita; päätökset- ja verkostotiedot ovat
          lähdepohjaisia mutta eivät täydellisen kattavia.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Kielletty käyttö</h2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Rikollinen tai muuten lainvastainen sisältö</li>
          <li>Uhkailu, häirintä, doxaus tai esiintyminen toisena henkilönä</li>
          <li>Roskaposti, kalastelu tai haittaohjelmalinkit</li>
          <li>Muiden käyttäjien tilien tai järjestelmän turvaominaisuuksien kiertäminen</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Maksut (prototyyppi)</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Prototyyppi simuloi maksut eikä veloita. Hinnasto on konfiguraatio, jota voidaan muuttaa.
          Ennen mahdollista maksujen aktivointia tehdään erillinen laskutus- ja kuluttajansuojaselvitys.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Muutokset</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Näitä ehtoja voidaan muuttaa; merkittävistä muutoksista ilmoitetaan palvelun kautta.
        </p>
      </section>
    </div>
  );
}