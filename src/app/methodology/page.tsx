import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menetelmät ja periaatteet" };

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Menetelmät ja periaatteet</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Vaikutusverkosto on <strong>lähdeperustainen</strong> selvitysalusta. Verkosto ei ole
          tuomio — <strong>lähteet ovat todisteet</strong>. Tämä sivu kertoo tarkasti, mitä
          tiedot tarkoittavat, miten ne on kerätty ja miten mittarit lasketaan.
        </p>
      </header>

      <Section id="what-this-is-not" title="Tärkeät rajaukset">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Yhteys ei automaattisesti todista vaikutusvaltaa.</strong> Dokumentoitu yhteys (esim. hallitusjäsenyys tai rahoitussuhde) kuvaa rakennetta, ei sen käyttöä.</li>
          <li><strong>Verkoston läheisyys ei todista väärinkäytöstä.</strong> Lähellä verkossa oleminen ei tarkoita yhteistoimintaa tai rikkomusta.</li>
          <li><strong>Rahoitussuhde ei automaattisesti tarkoita eturistiriitaa.</strong> Rahavirta on dokumentoitu tosiasia; sen tulkinta kuuluu lukijalle ja viranomaisille.</li>
          <li><strong>Johdettu mittari ei ole syytös.</strong> Mittarit ovat läpinäkyviä laskennallisia tunnuslukuja, eivät arvioita henkilön toiminnasta.</li>
        </ul>
      </Section>

      <Section id="relationships" title="Mikä lasketaan yhteydeksi">
        <p>
          Yhteys (relationship) on dokumentoitu suhde kahden toimijan välillä: esimerkiksi
          hallitusjäsenyys, omistus, lahjoitus, avustus, nimitys tai edustajuus. Jokaisella
          julkisella yhteydellä on <strong>ainakin yksi lähde</strong> (evidence). Ilman lähdettä
          yhteyttä ei julkaista.
        </p>
        <p>
          Perhesuhteita merkitään vain, jos ne ovat jo julkisia ja materiaalisesti merkityksellisiä —
          niitä ei koskaan päätellä.
        </p>
      </Section>

      <Section id="sources" title="Lähteet">
        <p>
          Ensisijaisia lähteitä suositaan: Eduskunnan avoin data, valtion virastojen rekisterit,
          tuomioistuinten julkiset asiakirjat, yhtiö- ja yhdistysrekisterit, vaali- ja
          puoluerahoitusilmoitukset, hankintarekisterit ja viralliset vuosikertomukset. Lähteen
          luokka merkitään (OFFICIAL_PRIMARY … SECONDARY_MEDIA) ja luottamus arvioidaan.
        </p>
        <p>
          Ei kaavita vastoin palvelun käyttöehtoja. Jos lähteet ovat ristiriidassa, niitä ei
          hiljaisesti valita — ristiriita näytetään.
        </p>
      </Section>

      <Section id="confidence" title="Luottamustasot">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>VERIFIED</strong> — virallinen ensisijainen lähde (esim. Eduskunnan rekisteri).</li>
          <li><strong>HIGH</strong> — useita riippumattomia, hyvälaatuisia lähteitä.</li>
          <li><strong>MEDIUM</strong> — yksittäinen hyvä lähde tai vahva epäsuora näyttö.</li>
          <li><strong>LOW</strong> — heikko näyttö; ei välttämättä julkisteta.</li>
          <li><strong>DISPUTED</strong> — lähteet ristiriidassa; merkitään &ldquo;tarkistettavana&rdquo;.</li>
        </ul>
        <p className="mt-2">Julkinen käyttöliittymä näyttää oletuksena VERIFIED/HIGH-tietoa.</p>
      </Section>

      <Section id="metrics" title="Mittarit">
        <p>
          Emme laske yhtä selittämätöntä &ldquo;valtapisteytystä&rdquo;. Tarjoamme erillisiä, läpinäkyviä
          mittareita, joiden jokaisen laskentatapa ja syötteet ovat avoimia:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Institutionaalinen valta</strong> — dokumentoidut viralliset tehtävät (nykyiset painavat 1, entiset 0,5).</li>
          <li><strong>Verkostokeskeisyys</strong> — aste-keskeisyys dokumentoitujen yhteyksien määrästä suhteutettuna verkon kokoon.</li>
          <li><strong>Hallitusroolit / Nimitykset</strong> — lukumäärät dokumentoiduista rooleista.</li>
          <li><strong>Rahavirrat</strong> — dokumentoitujen virtojen summa luottamuspainotettuna; eri tyyppejä ei lasketa yhteen ilman avointa tapaa.</li>
          <li><strong>Tiedon luotettavuus</strong> — yhdistelmä suhteiden luottamuksesta ja lähteiden määrästä (0–1).</li>
        </ul>
        <p className="mt-2">
          Johdetut mittarit ovat aina merkitty <strong>JOHDETTU</strong>-merkinnällä ja
          erotetaan dokumentoiduista tosiasioista (<strong>TOSI</strong>). Korrelaatio ei ole
          kausaliteetti — johdettuja päätelmiä ei esitetä syy-yhteytenä.
        </p>
      </Section>

      <Section id="tiers" title="Vallan tasot">
        <p>
          Rakenteellinen taso perustuu dokumentoitujen tehtävien ja yhteyksien määrään ja
          ulottuvuuteen. Taso ei ole moraaliarvio.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Valtakunnallinen järjestelmätason vaikutus</li>
          <li>Merkittävä institutionaalinen vaikutus</li>
          <li>Alueellinen / sektorikohtainen vaikutus</li>
          <li>Paikallinen / erikoisalavaikutus</li>
          <li>Dokumentoitu verkoston jäsen</li>
        </ol>
      </Section>

      <Section id="money" title="Rahavirtalaskenta">
        <p>
          Jokainen rahavirta kirjataan: maksaja, saaja, välittäjä (jos dokumentoitu), lopullinen
          hyötyjä (jos dokumentoitu), summa, valuutta, päivä/ajanjakso, virran tyyppi, tarkoitus,
          päätös ja lähde. Aggregointi (vuosi, organisaatio, sektori, kunta, puolue) on sallittua,
          mutta eri virta-tyyppejä ei lasketa yhteen ilman avointa laskentatapaa. Kaikki
          rahasummat sisältävät valuutan.
        </p>
        <p>
          <strong>Julkiset hankinnat (Tutki hankintoja):</strong> hankintavirrat ovat
          vuosittaisia kokonaisarvoja, jotka Suomen julkinen hankintatoimi on maksanut
          toimittajille. Maksajana näytetään aggregaatti &ldquo;Julkiset hankinnat – Suomi&rdquo;,
          koska lähde ei erittele virtaa yksittäiseen hankintayksikköön tällä rajapinnalla.
          Luottamukselliset toimittajat (esim. &ldquo;Salassa pidettävä&rdquo;) eivät koskaan
          päädy julkiseen dataan. Summa on lähdeperustainen kokonaisarvo, ei yksittäinen sopimus.
        </p>
      </Section>

      <Section id="procurement" title="Hankintadata">
        <p>
          Hankintavirrat perustuvat Valtiovarainministeriön ylläpitämään
          <a href="https://tutkihankintoja.fi/" target="_blank" rel="noreferrer" className="text-accent hover:underline"> tutkihankintoja.fi</a>-palveluun.
          Lähde on virallinen julkinen palvelu, josta kaikki hankintatiedot ovat kansalaisten
          tutkittavissa. Jokainen virta sisältää lähteen, noutoajan ja laskentatavan.
        </p>
      </Section>

      <Section id="privacy" title="Yksityisyys ja julkinen etu">
        <ul className="list-disc space-y-1 pl-5">
          <li>Yksityisiä osoitteita ei päätellä eikä näytetä.</li>
          <li>Puhelinnumeroita ja henkilökohtaisia sähköposteja ei julkaista ilman selvää julkista virkaperustetta.</li>
          <li>Seksuaalisuutta, uskontoa, terveyttä, etnistä taustaa tai poliittista ideologiaa ei päätellä.</li>
          <li>Rikollisuutta tai korruptiota ei väitetä ilman toimivaltaisen viranomaisen vahvistusta — ja silloinkin väite on lähdesidonnainen.</li>
          <li>Verkoston läheisyys ei ole väärinkäytöksen osoitus.</li>
        </ul>
      </Section>

      <Section id="neutrality" title="Poliittinen neutraalius">
        <p>
          Samaa ontologiaa, luottamussääntöjä ja julkaisukynnystä sovelletaan kaikkiin: vasemmisto,
          oikeisto, keskusta, hallitus, oppositio, yritykset, liitot, järjestöt, uskonnolliset
          yhteisöt, aktivismi, media ja julkinen hallinto. Luokittelut merkataan vain toimivaltaisen
          tahon perusteella (luokittelija, jurisdiktio, päivä, lähde).
        </p>
      </Section>

      <Section id="ai" title="Tekoälyn käyttö">
        <p>
          Autonomiset agentit eivät koskaan julkaise vahvistamattomia väitteitä. Putki on:
          HAVAITTU → POIMITTU → NORMALISOITU → TOIMIJA YHDISTETTY → LÄHDE VARMENNETTU →
          YHTEYS EHDOTETTU → LUOTTAMUS LASKETTU → RISKITARKISTUS → JULKAISTU. Herkät väitteet
          vaativat vahvempaa validointia tai ihmistarkistuksen. Kaikki agenttien ajot ovat
          näkyvissä hallintanäkymässä.
        </p>
      </Section>

      <Section id="corrections" title="Korjauskäytäntö">
        <p>
          Jokaisella profiililla on &ldquo;Ilmoita virheestä&rdquo;. Korjaukset käsitellään avoimesti,
          ja muutoshistoria säilyy. Historiallisia tosiasioita ei koskaan ylikirjoiteta
          tuhoavasti — ne versioidaan.
        </p>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 border-b border-ink-100 pb-1 text-sm font-bold uppercase tracking-wide text-ink-900">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}