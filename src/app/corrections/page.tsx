import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ilmoita virheestä" };

const CATEGORIES = [
  { value: "incorrect_person", label: "Väärä henkilö" },
  { value: "wrong_relationship", label: "Väärä yhteys" },
  { value: "outdated_role", label: "Vanhentunut tehtävä" },
  { value: "incorrect_amount", label: "Väärä summa" },
  { value: "missing_source", label: "Puuttuva lähde" },
  { value: "identity_collision", label: "Identiteettien sekoittuminen" },
  { value: "other", label: "Muu" },
];

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Ilmoita virheestä</h1>
        <p className="mt-1 text-sm text-ink-500">
          Näetkö virheen profiilissa, yhteydessä tai summassa? Ilmoita siitä — korjauspyyntö
          käsitellään avoimesti ja muutoshistoria säilyy.
        </p>
      </header>
      {sent === "1" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Kiitos! Korjauspyyntö on vastaanotettu ja jonossa käsiteltäväksi.
        </p>
      )}
      <form
        action="/api/corrections"
        method="post"
        className="card space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="label mb-1 block">Profiilin URL (esim. /person/…)</span>
            <input name="entityUrl" className="input" placeholder="https://…/person/…" required />
          </label>
          <label className="block text-sm">
            <span className="label mb-1 block">Luokka</span>
            <select name="category" className="input" defaultValue="wrong_relationship">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="label mb-1 block">Kuvaus</span>
          <textarea name="description" rows={4} className="input" placeholder="Mikä on väärin ja mihin lähde perustuu?" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="label mb-1 block">Sähköposti (valinnainen, yhteydenottoa varten)</span>
            <input name="email" type="email" className="input" placeholder="sahkoposti@esimerkki.fi" />
          </label>
        </div>
        <button type="submit" className="btn-primary">Lähetä korjauspyyntö</button>
      </form>
    </div>
  );
}