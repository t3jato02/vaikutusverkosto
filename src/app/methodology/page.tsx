import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menetelmät ja periaatteet" };

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="text-page-title">Menetelmät ja periaatteet</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
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

      <Section id="verification" title="Vahvistustilat">
        <p className="text-muted">
          Käyttöliittymässä näkyy ihmisluettava tila; suluissa on tietomallin tekninen tunniste.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Automaattisesti havaittu</strong> <Code>AUTO_DETECTED</Code> — agentti tai jäsennin löysi yhteyden, mutta sitä ei ole vielä riittävästi vahvistettu. Ei näytetä tavallisena vahvistettuna yhteytenä.</li>
          <li><strong>Vahvistettu lähteestä</strong> <Code>SOURCE_CONFIRMED</Code> — alkuperäinen tai riittävän vahva julkinen lähde tukee juuri kyseistä väitettä.</li>
          <li><strong>Ihmisen tarkistama</strong> <Code>HUMAN_VERIFIED</Code> — tarkastaja on lukenut lähteen ja hyväksynyt yhteyden. Agentti ei koskaan aseta tätä tilaa.</li>
          <li><strong>Kiistanalainen</strong> <Code>DISPUTED</Code> — yhteydestä on uskottava ristiriita tai korjauspyyntö. Näytetään selvästi merkittynä.</li>
          <li><strong>Hylätty</strong> <Code>REJECTED</Code> — automaattinen havainto todettiin virheelliseksi. Ei julkisessa graafissa.</li>
          <li><strong>Vanhentunut</strong> <Code>STALE</Code> — tieto oli aiemmin pätevä, mutta nykytila on todennäköisesti muuttunut. Historiaa ei poisteta.</li>
        </ul>
        <p className="mt-2">
          Ei-deterministiset tai toissijaiset lähteet (mediakooste, järjestön raportti, semanttinen
          poiminta) tuottavat <strong>suhde-ehdokkaita</strong>, joita ei julkaista automaattisesti,
          vaan ne käyvät läpi ihmisen tarkistuksen.
        </p>
      </Section>

      <Section id="temporal" title="Nykyinen vai historiallinen">
        <p>
          Jokainen yhteys on ajallinen. Jos päättymispäivä on menneisyydessä tai tehtävä on
          merkitty päättyneeksi, yhteyttä <strong>ei näytetä nykyisenä</strong>. Avoin, lähteen
          aktiiviseksi vahvistama rooli on <strong>Nykyinen</strong> <Code>CURRENT</Code>; pelkän
          historiadokumentin varassa oleva yhteys on <strong>Historiallinen</strong>{" "}
          <Code>HISTORICAL</Code> tai <strong>Ajankohta epävarma</strong> <Code>UNKNOWN_PERIOD</Code>,
          ei automaattisesti nykyinen. Historiallista yhteyttä ei poisteta.
        </p>
      </Section>

      <Section id="neutrality" title="Neutraali evidenssistandardi">
        <p>
          Sama evidenssistandardi koskee kaikkia valtioita ja organisaatioita — Yhdysvaltoja,
          Kiinaa, Venäjää, Qataria, Saudi-Arabiaa, EU-maita, säätiöitä, kansalaisjärjestöjä,
          uskonnollisia organisaatioita ja yrityksiä.
        </p>
        <p className="mt-2">
          Henkilön <strong>kansallisuus, etninen tausta, uskonto tai syntymämaa ei itsessään</strong> ole
          vaikuttamissuhde eikä riskisignaali. Merkitystä on vain dokumentoidulla rahoituksella,
          omistuksella, tehtävällä, jäsenyydellä, sopimuksella, lahjoituksella tai päätöksellä —
          ja jokaisella on lähde. Järjestelmä ei laske yleistä maa-, uskonto- tai
          etnisyysperustaista &quot;epäilyttävyys-scorea&quot;.
        </p>
        <p className="mt-2">
          Organisaation saama rahoitus ei ole siihen liittyvän henkilön henkilökohtaista
          rahoitusta ilman eksplisiittistä, dokumentoitua yhteyttä.
        </p>
      </Section>

      <Section id="international-funding" title="Kansainvälinen rahoitus">
        <p>
          <strong>Kansainväliset yhteydet</strong> -näkymä esittää dokumentoituja kansainvälisiä
          rahavirtoja ja yhteyksiä. Ensimmäinen lähde on EU:n Financial Transparency System (FTS):
          EU-budjetin sitoumus- ja sopimusrivit, joiden edunsaajan maa on Suomi. Jokainen rivi on
          erillinen, evidensoitu rahavirta <em>Euroopan komissio → suomalainen saaja</em>.
        </p>
        <p className="mt-2">
          Ulkomainen tai EU-rahoitus <strong>ei itsessään</strong> tarkoita laitonta vaikuttamista,
          korruptiota, epälojaaliutta tai agenttisuhdetta. Se on dokumentoitu rahoitussuhde.
        </p>
        <p className="mt-2">
          <strong>Suora suhde vs. verkostopolku.</strong> Jos ulkomainen rahoittaja rahoittaa
          organisaatiota, ja henkilö on kyseisen organisaation hallituksen jäsen, se <em>ei</em>
          tarkoita, että henkilö sai ulkomaista rahoitusta. Käyttöliittymä voi näyttää
          verkostopolun, mutta tietokanta ei luo suoraa rahavirtaa henkilölle, joka ei ole
          rahavirran vastaanottaja.
        </p>
        <p className="mt-2">
          Sama evidenssistandardi koskee kaikkia rahoittajia riippumatta maasta (EU, Yhdysvallat,
          Venäjä, Kiina, Qatar, Saudi-Arabia, Pohjoismaat) tai organisaatiotyypistä (säätiö,
          kansalaisjärjestö, yritys, uskonnollinen organisaatio, valtio).
        </p>
        <p className="mt-2">
          <strong>Vuositieto.</strong> EU FTS -aineistossa &quot;vuosi&quot; on <em>rahoitus- eli
          budjettivuosi</em>. Hankkeen alkamis- ja päättymispäivät kuvaavat <em>hankekautta</em>.
          Aineisto ei sisällä erillistä myöntö- tai maksupäivää, joten järjestelmä ei esitä
          sellaista. Eri vuosien rivit säilytetään erillisinä rahavirtoina.
        </p>
        <p className="mt-2">
          Rahoituslajeja ei lasketa keskenään yhteen ilman selkeää perustetta (avustus, hankinta ja
          muu on eroteltu). Alkuperäinen sopimustyyppi säilytetään sellaisenaan.
        </p>
      </Section>

      <Section id="network-metrics" title="Verkostomittarit">
        <p>
          Verkoston rakennetta voidaan kuvata mittareilla kuten astekeskeisyys (kuinka moneen
          toimijaan entity on suoraan kytketty) ja välittäjäasema (kuinka usein entity sijaitsee
          kahden muun toimijan lyhimmällä verkostopolulla). Nämä kuvaavat <strong>verkon
          rakennetta</strong>, eivät henkilön moraalia, lainmukaisuutta tai syyllisyyttä. Korkea
          arvo ei ole syytös eikä &quot;epäilyttävyys-score&quot;.
        </p>
      </Section>

      <Section id="source-quality" title="Lähteiden laatu">
        <p>
          Lähteet suositaan järjestyksessä: (1) alkuperäinen viranomaisrekisteri tai -rajapinta,
          (2) alkuperäinen päätös tai dokumentti, (3) organisaation oma virallinen raportti,
          (4) muu primäärilähde, (5) luotettava journalistinen lähde täydentävänä. Journalistinen
          lähde ei ole samanarvoinen alkuperäisen viranomaisrekisterin kanssa. Sama yhteys voi
          saada useita vahvistavia lähteitä; pelkkä lähteiden lukumäärä ei nosta vahvistustilaa
          ilman semanttista yhteensopivuutta.
        </p>
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
          luokka merkitään (virallisesta ensisijaisesta lähteestä toissijaiseen mediaan) ja
          luottamus arvioidaan.
        </p>
        <p>
          Ei kaavita vastoin palvelun käyttöehtoja. Jos lähteet ovat ristiriidassa, niitä ei
          hiljaisesti valita — ristiriita näytetään.
        </p>
      </Section>

      <Section id="confidence" title="Luottamustasot">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Varmennettu</strong> <Code>VERIFIED</Code> — virallinen ensisijainen lähde (esim. Eduskunnan rekisteri).</li>
          <li><strong>Korkea varmuus</strong> <Code>HIGH</Code> — useita riippumattomia, hyvälaatuisia lähteitä.</li>
          <li><strong>Kohtalainen varmuus</strong> <Code>MEDIUM</Code> — yksittäinen hyvä lähde tai vahva epäsuora näyttö.</li>
          <li><strong>Matala varmuus</strong> <Code>LOW</Code> — heikko näyttö; ei välttämättä julkisteta.</li>
          <li><strong>Kiistanalainen</strong> <Code>DISPUTED</Code> — lähteet ristiriidassa; merkitään &ldquo;tarkistettavana&rdquo;.</li>
        </ul>
        <p className="mt-2">Julkinen käyttöliittymä näyttää oletuksena varmennettua ja korkean varmuuden tietoa.</p>
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
          Johdetut mittarit merkitään aina erikseen laskennallisiksi ja erotetaan
          dokumentoiduista, lähteeseen perustuvista tosiasioista. Korrelaatio ei ole kausaliteetti
          — johdettuja päätelmiä ei esitetä syy-yhteytenä.
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
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-2 border-b border-line pb-1.5 text-[15px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-700 [&_a]:underline [&_a]:decoration-accent/50 [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  );
}

/** Technical enum tag shown secondary to the human label. */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px] font-medium text-muted">{children}</code>
  );
}