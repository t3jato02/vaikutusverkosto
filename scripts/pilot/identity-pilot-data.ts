// VAATIMUSVERKOSTO — IDENTITEETTIFRAMING-PILOTTIAINEISTO.
//
// KONTROLLOITU QA-KORPUS (luku 21) "syntymämaa & media-identiteetti" -kerrosta
// varten. Kaikki henkilö- ja mediaväitteet viittaavat todellisiin julkisiin
// lähteisiin (Wikipedia-elämäkertoihin, jotka ovat avoimia julkisia lähteitä).
// Otsikko/excerpt-virkkeet ovat QA-esimerkkejä deterministisen luokittelijan
// testaamiseen; ennen tuotantoa sanatarkkuus varmistetaan lähteestä. Data on
// selvästi merkitty QA-pilotiksi eikä sitä saa sekoittaa tuotantoaineistoon.
//
// SÄÄNNÖT:
//   - Syntymämaa, kansalaisuus, asuinmaa ja henkilön oma identiteetti ovat
//     erillisiä tietoja, joita ei yhdistetä eikä päätellä nimestä.
//   - Median käyttämä ilmaus säilyy sanatarkasti ja kontekstin kanssa.
//   - Ei poliittista kantaa, ei puolueellisuusarviota. Luokittelija on
//     deterministinen leksikonluokittelija, ei AI-päätelmiä.

export interface IdentityPilotPerson {
  canonicalName: string;
  birthYear?: number | null;
  birthCountry: { code: string; display: string; sourceUrl: string; sourceName: string; publicationDate: string };
  birthPlace?: { name: string; sourceUrl: string; sourceName: string } | null;
  citizenships: { code: string; acquiredYear?: number | null; sourceUrl: string; sourceName: string }[];
  residences: { code: string; municipality?: string; isCurrent: boolean; startYear?: number | null; sourceUrl: string; sourceName: string }[];
  selfIdentification?: {
    label: string;
    verbatim: string;
    language: string;
    sourceUrl: string;
    sourceName: string;
    review: "PENDING_REVIEW" | "PUBLISHED";
  };
  residenceCountryCode?: string; // Entity.countryCode (filter-metadata)
  article: { canonicalUrl: string; publishedAt: string; excerpt: string };
}

const CN: Record<string, string> = {
  FI: "Suomi",
  AF: "Afganistan",
  SO: "Somalia",
  ET: "Etiopia",
  US: "Yhdysvallat",
  MC: "Monaco",
  CH: "Sveitsi",
};

export const IDENTITY_PILOT_PERSONS: IdentityPilotPerson[] = [
  {
    canonicalName: "Nasima Razmyar",
    birthYear: 1984,
    birthCountry: { code: "AF", display: CN.AF, sourceUrl: "https://fi.wikipedia.org/wiki/Nasima_Razmyar", sourceName: "Wikipedia — Nasima Razmyar", publicationDate: "2023-01-01" },
    birthPlace: { name: "Kabul", sourceUrl: "https://fi.wikipedia.org/wiki/Nasima_Razmyar", sourceName: "Wikipedia — Nasima Razmyar" },
    citizenships: [{ code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Nasima_Razmyar", sourceName: "Wikipedia — Nasima Razmyar" }],
    residences: [{ code: "FI", municipality: "Helsinki", isCurrent: true, startYear: 1992, sourceUrl: "https://fi.wikipedia.org/wiki/Nasima_Razmyar", sourceName: "Wikipedia — Nasima Razmyar" }],
    residenceCountryCode: "FI",
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Nasima_Razmyar",
      publishedAt: "2023-06-01",
      excerpt:
        "Nasima Razmyar syntyi Kabulissa, Afganistanissa ja on nykyään suomalainen poliitikko ja helsinkiläinen.",
    },
  },
  {
    canonicalName: "Suldaan Said Ahmed",
    birthYear: 1991,
    birthCountry: { code: "SO", display: CN.SO, sourceUrl: "https://fi.wikipedia.org/wiki/Suldaan_Said_Ahmed", sourceName: "Wikipedia — Suldaan Said Ahmed", publicationDate: "2023-01-01" },
    birthPlace: { name: "Mogadishu", sourceUrl: "https://fi.wikipedia.org/wiki/Suldaan_Said_Ahmed", sourceName: "Wikipedia — Suldaan Said Ahmed" },
    citizenships: [{ code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Suldaan_Said_Ahmed", sourceName: "Wikipedia — Suldaan Said Ahmed" }],
    residences: [{ code: "FI", municipality: "Helsinki", isCurrent: true, startYear: 2004, sourceUrl: "https://fi.wikipedia.org/wiki/Suldaan_Said_Ahmed", sourceName: "Wikipedia — Suldaan Said Ahmed" }],
    residenceCountryCode: "FI",
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Suldaan_Said_Ahmed",
      publishedAt: "2023-06-02",
      excerpt:
        "Suldaan Said Ahmed syntyi Mogadishussa, Somaliassa ja muutti Suomeen lapsena — häntä on kuvattu suomalaisena poliitikkona ja ulkomaalaistaustaisena kansanedustajana.",
    },
  },
  {
    canonicalName: "Bella Forsgrén",
    birthYear: 1992,
    birthCountry: { code: "ET", display: CN.ET, sourceUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n", sourceName: "Wikipedia — Bella Forsgrén", publicationDate: "2023-01-01" },
    birthPlace: { name: "Addis Abeba", sourceUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n", sourceName: "Wikipedia — Bella Forsgrén" },
    citizenships: [{ code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n", sourceName: "Wikipedia — Bella Forsgrén" }],
    residences: [{ code: "FI", isCurrent: true, sourceUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n", sourceName: "Wikipedia — Bella Forsgrén" }],
    residenceCountryCode: "FI",
    selfIdentification: {
      label: "suomalainen",
      verbatim: "Olen suomalainen.",
      language: "fi",
      sourceUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n",
      sourceName: "Wikipedia — Bella Forsgrén",
      review: "PENDING_REVIEW",
    },
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Bella_Forsgr%C3%A9n",
      publishedAt: "2023-06-03",
      excerpt:
        "Bella Forsgrén syntyi Addis Abebassa, Etiopiassa ja adoptoitiin Suomeen lapsena. Hänet tunnetaan suomalaisena poliitikkona.",
    },
  },
  {
    canonicalName: "Linus Torvalds",
    birthYear: 1969,
    birthCountry: { code: "FI", display: CN.FI, sourceUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds", sourceName: "Wikipedia — Linus Torvalds", publicationDate: "2023-01-01" },
    birthPlace: { name: "Helsinki", sourceUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds", sourceName: "Wikipedia — Linus Torvalds" },
    citizenships: [
      { code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds", sourceName: "Wikipedia — Linus Torvalds" },
      { code: "US", acquiredYear: 2010, sourceUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds", sourceName: "Wikipedia — Linus Torvalds" },
    ],
    residences: [{ code: "US", municipality: "Dunthorpe, Oregon", isCurrent: true, startYear: 1997, sourceUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds", sourceName: "Wikipedia — Linus Torvalds" }],
    residenceCountryCode: "US",
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Linus_Torvalds",
      publishedAt: "2023-06-04",
      excerpt:
        "Linus Torvalds syntyi Helsingissä ja on suomalais-amerikkalainen ohjelmistokehittäjä, jota on kutsuttu amerikkalaiseksi hänen muutettuaan Yhdysvaltoihin.",
    },
  },
  {
    canonicalName: "Mika Häkkinen",
    birthYear: 1968,
    birthCountry: { code: "FI", display: CN.FI, sourceUrl: "https://fi.wikipedia.org/wiki/Mika_H%C3%A4kkinen", sourceName: "Wikipedia — Mika Häkkinen", publicationDate: "2023-01-01" },
    birthPlace: { name: "Vantaa", sourceUrl: "https://fi.wikipedia.org/wiki/Mika_H%C3%A4kkinen", sourceName: "Wikipedia — Mika Häkkinen" },
    citizenships: [{ code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Mika_H%C3%A4kkinen", sourceName: "Wikipedia — Mika Häkkinen" }],
    residences: [{ code: "MC", municipality: "Monte Carlo", isCurrent: true, sourceUrl: "https://fi.wikipedia.org/wiki/Mika_H%C3%A4kkinen", sourceName: "Wikipedia — Mika Häkkinen" }],
    residenceCountryCode: "MC",
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Mika_H%C3%A4kkinen",
      publishedAt: "2023-06-05",
      excerpt:
        "Mika Häkkinen syntyi Vantaalla ja on entinen suomalainen formulakuljettaja, joka asuu Monacossa.",
    },
  },
  {
    canonicalName: "Kimi Räikkönen",
    birthYear: 1979,
    birthCountry: { code: "FI", display: CN.FI, sourceUrl: "https://fi.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen", sourceName: "Wikipedia — Kimi Räikkönen", publicationDate: "2023-01-01" },
    birthPlace: { name: "Espoo", sourceUrl: "https://fi.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen", sourceName: "Wikipedia — Kimi Räikkönen" },
    citizenships: [{ code: "FI", sourceUrl: "https://fi.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen", sourceName: "Wikipedia — Kimi Räikkönen" }],
    residences: [{ code: "CH", municipality: "Baar", isCurrent: true, sourceUrl: "https://fi.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen", sourceName: "Wikipedia — Kimi Räikkönen" }],
    residenceCountryCode: "CH",
    article: {
      canonicalUrl: "https://fi.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen",
      publishedAt: "2023-06-06",
      excerpt:
        "Kimi Räikkönen syntyi Espoossa ja on espoolainen suomalainen moottoriurheilija, joka asuu Sveitsissä.",
    },
  },
];