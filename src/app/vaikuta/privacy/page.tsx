import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tietosuoja" };
export const dynamic = "force-dynamic";

export default function VaikutaPrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Vaikuta — tietosuoja</h1>
        <p className="mt-1 text-sm text-ink-500">
          Yhteenveto siitä, mitä tietoja käsittelemme ja miksi. Tietosuojaperiaatteet noudattavat
          GDPR-henkisiä minimointi- ja läpinäkyvyysperiaatteita; tämä dokumentti ei ole oikeudellinen
          lausunto.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="card-title">Mitä keräämme</h2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Tunnuksesi varten: sähköposti ja salasanavaatesalattu hash (käsitellään suojatusti).</li>
          <li>Kampanjasi: otsikko, viestin sisältö, valitut vastaanottajat ja tapahtumahistoria.</li>
          <li>Analytiikka: tuote-tapahtumat ilman viestisisältöä.</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Mitä emme kerää</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Emme tallenna maksukorttitietoja, emmekä arvaa tai tallenna käyttäjien poliittisia
          vakaumuksia, etnisyyttä, uskontoa tai muita erityisiä henkilötietoja. Emme näytä käyttäjän
          yksityisiä tietoja julkisesti oletuksena.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Vastaanottajat ja säilytys</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Vastaanottajatiedot ovat julkisia, lähdepohjaisia rooli-/tehtävätietoja, joita käytetään vain
          sinun toimituksesi valmisteluun. Kampanjatietosi ovat yksityisiä, ellei käyttäjä itse
          erikseen julkaise julkista kampanjasivua.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Oikeutesi</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Voit pyytää tietojesi nähtäväksi, korjattavaksi tai poistetuksi ylläpidon kautta.
          Poisto koskee myös kampanjatietojasi (tapahtumahistoria voidaan säilyttää
          anonymisoituna auditoinnin vuoksi).
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="card-title">Julkinen verkosto</h2>
        <p className="text-[13px] text-ink-700">
          Vaikutusverkoston julkinen verkostotieto on erillinen julkinen rekisteri, jota ylläpidetään
          omien menetelmiensä mukaisesti (ks. <em>/methodology</em>).
        </p>
      </section>
    </div>
  );
}