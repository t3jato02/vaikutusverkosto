import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Real, public coordinates of Finnish towns. Only municipalities in this list
// get a dot; everything else is listed as text below. Never a private residence.
const TOWNS: Record<string, [number, number]> = {
  Helsinki: [60.17, 24.94],
  Espoo: [60.21, 24.66],
  Vantaa: [60.29, 25.04],
  Tampere: [61.5, 23.76],
  Turku: [60.45, 22.27],
  Oulu: [65.01, 25.47],
  Jyväskylä: [62.24, 25.75],
  Lahti: [60.98, 25.66],
  Kuopio: [62.89, 27.68],
  Kouvola: [60.87, 26.7],
  Pori: [61.49, 21.8],
  Joensuu: [62.6, 29.76],
  Lappeenranta: [61.06, 28.19],
  Hämeenlinna: [60.99, 24.46],
  Vaasa: [63.1, 21.62],
  Rovaniemi: [66.5, 25.73],
  Kajaani: [64.22, 27.73],
  Seinäjoki: [62.79, 22.84],
  Mikkeli: [61.69, 27.27],
  Kokkola: [63.84, 23.13],
  Kotka: [60.47, 26.94],
  Rauma: [61.13, 21.51],
  Salo: [60.38, 23.13],
  Porvoo: [60.39, 25.66],
  Kerava: [60.4, 25.11],
};

const BOUNDS = { latMin: 59.6, latMax: 70.1, lonMin: 19.3, lonMax: 31.6 };

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * 400 + 20;
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * 520 + 20;
  return { x, y };
}

export default async function MapPage() {
  const byMunicipalityRaw = await db.entity.groupBy({
    by: ["municipality"],
    _count: { _all: true },
  });
  const byMunicipality = byMunicipalityRaw
    .map((r) => ({ municipality: r.municipality, count: (r._count as { _all: number })._all ?? 0 }))
    .filter((r) => r.municipality)
    .sort((a, b) => b.count - a.count);

  const rows = byMunicipality;
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">Kartta</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Toimijoiden julkinen sijainti: kotikunta, vaalipiiri, virka tai institutionaalinen
          sijainti. Yksityisiä asuinpaikkoja ei koskaan päätellä tai näytetä.
        </p>
      </header>

      <section aria-label="Karttanäkymä" className="card overflow-x-auto">
        <svg viewBox="0 0 440 560" role="img" aria-label="Kaaviomainen kartta Suomesta: pisteet edustavat kuntia, joissa toimijoita on eniten" className="mx-auto w-full max-w-xl">
          <rect x="10" y="10" width="420" height="540" rx="8" fill="#f3f4f1" />
          <text x="220" y="30" textAnchor="middle" className="fill-ink-500" fontSize="11">
            Kaaviomainen kartta — pisteiden koko = toimijoiden määrä
          </text>
          {rows.map((r) => {
            const coords = TOWNS[r.municipality!];
            if (!coords) return null;
            const { x, y } = project(coords[0], coords[1]);
            const rpx = 4 + (r.count / maxCount) * 14;
            return (
              <g key={r.municipality}>
                <circle cx={x} cy={y} r={rpx} fill="#0f5ea8" opacity="0.75" />
                <title>{`${r.municipality}: ${r.count} toimijaa`}</title>
              </g>
            );
          })}
        </svg>
      </section>

      <section aria-label="Kunnat">
        <h2 className="card-title mb-2">TOIMIJAT KUNNITTAIN</h2>
        <ul className="card divide-y divide-ink-100">
          {rows.slice(0, 40).map((r) => (
            <li key={r.municipality} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-medium text-ink-900">{r.municipality}</span>
              <span className="text-sm tabular-nums text-ink-500">{formatNumber(r.count)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-ink-400">
        Huomautus: näkymä on kaaviomainen. Alueellinen kokonaiskattavuus (kunnat, hyvinvointialueet,
        vaalipiirit) rakentuu vaiheessa B. Kuntien määrällinen näkymä päivittyy reaaliajasta.
      </p>
    </div>
  );
}