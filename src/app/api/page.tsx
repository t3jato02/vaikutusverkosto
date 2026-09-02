import type { Metadata } from "next";

export const metadata: Metadata = { title: "API" };

const ENDPOINTS = [
  { method: "GET", path: "/api/search?q=&limit=", desc: "Haku: henkilöt, organisaatiot, rahavirrat." },
  { method: "GET", path: "/api/entities?type=&q=&page=&per_page=", desc: "Toimijoiden luettelo (sivutus, tyyppi- ja hakusuodatin)." },
  { method: "GET", path: "/api/entities/:id", desc: "Toimijan tiedot UUID:lla." },
  { method: "GET", path: "/api/entities/:id/relationships", desc: "Toimijan dokumentoidut suhteet." },
  { method: "GET", path: "/api/entities/:id/graph?depth=&flows=", desc: "Verkostograafi (solmut + viivat)." },
  { method: "GET", path: "/api/changes?limit=", desc: "Julkinen muutosvirta." },
  { method: "GET", path: "/api/money", desc: "Rahavirta-aggregoidit tyypeittäin ja saajittain." },
];

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-bold">Julkinen API</h1>
        <p className="mt-1 text-sm text-ink-500">
          Avoin, dokumentoitu ja rajoitettu API. Kaikki päätiedot ovat myös selaimessa käytettävissä.
          Käytä maltillisesti — pyyntöjä rajoitetaan IP:tä kohti.
        </p>
      </header>
      <section className="card divide-y divide-ink-100">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
            <code className="shrink-0 rounded bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-900">
              <span className="font-bold text-accent">{e.method}</span> {e.path}
            </code>
            <span className="text-sm text-ink-500">{e.desc}</span>
          </div>
        ))}
      </section>
      <section className="card space-y-2 text-sm text-ink-700">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900">Käyttöesimerkki</h2>
        <pre className="overflow-x-auto rounded bg-ink-900 p-3 text-xs text-emerald-300">
{`# Hae
curl "https://vaikutusverkosto.example/api/search?q=Orpo"

# Graafi
curl "https://vaikutusverkosto.example/api/entities/&lt;uuid&gt;/graph?depth=2&flows=true"`}
        </pre>
        <p className="text-xs text-ink-500">
          Vastaukset ovat JSON-muotoisia. HTTP 429 tarkoittaa rajoituksen ylittymistä. Lähdeviittaukset
          sisältyvät suhteisiin (evidence → source).
        </p>
      </section>
    </div>
  );
}