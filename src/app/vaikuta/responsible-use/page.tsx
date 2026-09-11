import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vastuullinen käyttö" };
export const dynamic = "force-dynamic";

export default function ResponsibleUsePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Vastuullinen käyttö</h1>
        <p className="mt-1 text-sm text-ink-500">
          Vaikuta on kansalaisvaikuttamisen työkalu, ei painostus- tai häirintäväline.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="card-title">Mikä ei ole väärinkäyttöä</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Poliittinen erimielisyys, asiallinen kritiikki ja vahvasti sanoitetut, lainmukaiset mielipiteet
          eivät ole väärinkäyttöä. Niitä ei merkitä eikä estetä.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Kielletyt tai tarkistettavat sisällöt</h2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-700">
          <li>Uskottavat uhkaukset</li>
          <li>Kohdennettu häirintä (toistuva, rajoja rikkova yhteydenpito)</li>
          <li>Doxxaus eli yksityisten tietojen (osoitteet, puhelimet) levittäminen</li>
          <li>Esiintyminen toisena henkilönä tai viranomaisena</li>
          <li>Selvä roskaposti ja kalastelu/haittaohjelmalinkit</li>
          <li>Toistuvat olennaisesti samat kampanjat, jotka pyrkivät ylikuormittamaan yksittäistä vastaanottajaa</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Läpinäkyvyys</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Vaikutusverkosto ei ota kantaa käyttäjien viesteihin. Vastaanottajien valinta perustuu
          dokumentoituihin institutionaalisiin suhteisiin. AI-avustaja ei määritä poliittistasi kantaa.
          Käyttäjä hyväksyy viestin ennen lähettämistä. Prototyyppi ei veloita eikä lähetä viestejä.
        </p>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Vaikutusverkosto suosittelee harkintaa: yhteydenotto syntyy omalla nimelläsi ja siihen voidaan
          vastata julkisesti tai ottaa se huomioon päätöksen valmistelussa.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="card-title">Väärinkäytöksen ilmoittaminen</h2>
        <p className="text-[13px] text-ink-700">
          Havaitusta väärinkäytöksestä voi ilmoittaa ylläpitotietojen kautta. Epäillyt kampanjat voidaan
          keskeyttää ja toimitus pysäyttää yksittäiselle kampanjalle tai käyttäjälle.
        </p>
      </section>
    </div>
  );
}