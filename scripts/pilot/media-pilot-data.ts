// VAATIMUSVERKOSTO — MEDIA-JA-TOIMITTAJAT PILOTTIAINEISTO.
//
// KONTROLLOITU PILOTTIKORPUS (section 26). Sisältää:
//   - tunnetut suomalaiset mediat, konsernit ja niiden julkiset omistussuhteet
//   - julkisesti tunnistettavia toimittajia
//   - HAVAINNOITUA JULKAISUDATAA: otsikko, canonical URL ja julkaisuajankohta
//     haettu suoraan median omasta RSS-syötteestä / sivustolta (real, ei keksittyä).
//
// SÄÄNNÖT (sovellettu kaikkiin riveihin yhtäläisesti):
//   - Kaikki väitteet edellyttävät osoitettavaa lähdettä (media-alan domain).
//   - Ei synnyinmaan/kansallisuuden/kielen/infon päätelmiä nimestä.
//   - Ei poliittisen kannan päätelmiä sisältöanalyysistä.
//   - Median institutionaalista taustaa ei siirretä yksittäiseen toimittajaan.
//   - Artikkelin maininta ei ole henkilösuhde.
//
// Kirjoittajakytkennät: IL-juttujen byline on luettu artikkeli-sivun byline-kentästä
// (Mikael Shepelenko/Näkökulma-Saksa, Mika Koskinen/PS-kokoomus). HS- ja MTV-profiilit
// perustetaan julkisesti dokumentoituihin tehtäviin, jotka tunnistetaan sivustojen
// toimitus- ja tekijäesittelyistä.

export type PilotGenre = "NEWS" | "ANALYSIS" | "COMMENT" | "COLUMN" | "OPINION" | "INVESTIGATIVE" | "INTERVIEW" | "OTHER";

export interface PilotArticle {
  outlet: string; // pilot-slug of the outlet
  title: string;
  url: string; // canonical URL (real)
  publishedAt: string; // ISO-8601
  genre: PilotGenre;
  section: string;
  excerpt?: string;
  topics: string[];
  authors?: string[]; // pilot-slugs of journalists (real byline when known)
}

export interface PilotJournalist {
  slug: string;
  name: string;
  subtype: string;
  outlet: string; // current employer (pilot-slug)
  currentRole: string;
  specialties: string[];
  topics: string[];
  sourceUrl: string; // employer / author page domain or authoring byline source
  sourceName: string;
  activeYearsFrom?: number;
}

export interface PilotOutlet {
  slug: string;
  name: string;
  url: string;
  outletType: string; // MediaOutletType
  foundingYear?: number;
  countryCode?: string;
  languages: string[];
  jsnMember?: boolean;
  fundingModel?: string;
  ownerSlug?: string; // parent company/group (pilot-slug)
  editorialAffiliation?: { type: "FORMALLY_PARTY_AFFILIATED" | "HISTORICALLY_PARTY_AFFILIATED"; partyHint: string; sourceUrl: string };
}

export interface PilotCompany {
  slug: string;
  name: string;
  subtype?: string;
  url: string;
  note: string;
}

// ---------------------------------------------------------------- companies

export const PILOT_COMPANIES: PilotCompany[] = [
  { slug: "alma-media", name: "Alma Media Oyj", subtype: "MEDIA_GROUP", url: "https://www.almamedia.fi", note: "Julkinen mediakonserni" },
  { slug: "sanoma", name: "Sanoma Oyj", subtype: "MEDIA_GROUP", url: "https://www.sanoma.fi", note: "Julkinen mediakonserni" },
  { slug: "telia", name: "Telia Company AB", subtype: "MEDIA_COMPANY", url: "https://www.teliacompany.com", note: "Pörssiyhtiö, omistaa MTV:n" },
];

// ---------------------------------------------------------------- outlets

export const PILOT_OUTLETS: PilotOutlet[] = [
  {
    slug: "iltalehti", name: "Iltalehti", url: "https://www.iltalehti.fi", outletType: "NEWS_PAPER",
    foundingYear: 1980, countryCode: "FI", languages: ["fi"], jsnMember: true,
    fundingModel: "Kaupallinen (tilaukset, mainonta)", ownerSlug: "alma-media",
  },
  {
    slug: "hs", name: "Helsingin Sanomat", url: "https://www.hs.fi", outletType: "NEWS_PAPER",
    foundingYear: 1889, countryCode: "FI", languages: ["fi"], jsnMember: true,
    fundingModel: "Kaupallinen (tilaukset, mainonta)", ownerSlug: "sanoma",
  },
  {
    slug: "yle", name: "Yle", url: "https://yle.fi", outletType: "BROADCASTER",
    foundingYear: 1926, countryCode: "FI", languages: ["fi", "sv"], jsnMember: true,
    fundingModel: "Julkinen palvelu (verorahoitus)",
  },
  {
    slug: "mtv", name: "MTV Uutiset", url: "https://www.mtvuutiset.fi", outletType: "BROADCASTER",
    foundingYear: 1957, countryCode: "FI", languages: ["fi"], jsnMember: true,
    fundingModel: "Kaupallinen (mainonta, tilaukset)", ownerSlug: "telia",
  },
  {
    slug: "demokraatti", name: "Demokraatti", url: "https://demokraatti.fi", outletType: "PARTY_MEDIA",
    foundingYear: 2013, countryCode: "FI", languages: ["fi"],
    fundingModel: "Puoluesidonnainen; julkaisee SDP:n äänenkannattajaksi itsensä määrittelevää sisältöä",
    editorialAffiliation: { type: "FORMALLY_PARTY_AFFILIATED", partyHint: "Suomen Sosialidemokraattinen Puolue", sourceUrl: "https://demokraatti.fi" },
  },
  {
    slug: "suomenuutiset", name: "Suomen Uutiset", url: "https://www.suomenuutiset.fi", outletType: "PARTY_MEDIA",
    foundingYear: 2005, countryCode: "FI", languages: ["fi"],
    fundingModel: "Puoluesidonnainen",
    editorialAffiliation: { type: "FORMALLY_PARTY_AFFILIATED", partyHint: "Perussuomalaiset", sourceUrl: "https://www.suomenuutiset.fi" },
  },
  {
    slug: "verkkouutiset", name: "Verkkouutiset", url: "https://www.verkkouutiset.fi", outletType: "ONLINE_MEDIA",
    countryCode: "FI", languages: ["fi"], fundingModel: "Kaupallinen / aatteellinen",
  },
  {
    slug: "kansanuutiset", name: "Kansan Uutiset", url: "https://www.kansanuutiset.fi", outletType: "ONLINE_MEDIA",
    countryCode: "FI", languages: ["fi"], fundingModel: "Aatteellinen / tilaajapohjainen",
  },
];

// ---------------------------------------------------------------- journalists

export const PILOT_JOURNALISTS: PilotJournalist[] = [
  {
    slug: "mikael-shepelenko", name: "Mikael Shepelenko", subtype: "FOREIGN_REPORTER",
    outlet: "iltalehti", currentRole: "Ulkomaantoimittaja", specialties: ["ulkomaat", "turvallisuuspolitiikka", "Saksa", "Venäjä"],
    topics: ["ulkomaat", "turvallisuuspolitiikka", "vaalit"],
    sourceUrl: "https://www.iltalehti.fi/ulkomaat/a/ba190b96-e4b4-4551-b8f6-d39ce74cdfa6",
    sourceName: "Iltalehti — Näkökulma: Äärioikeistolle murskavoitto (byline)",
  },
  {
    slug: "mika-koskinen", name: "Mika Koskinen", subtype: "POLITICS_REPORTER",
    outlet: "iltalehti", currentRole: "Politiikan toimittaja", specialties: ["eduskunta", "politiikka"],
    topics: ["politiikka", "eduskunta"],
    sourceUrl: "https://www.iltalehti.fi/politiikka/a/afe9db4c-142f-4b13-9631-e6af4deec323",
    sourceName: "Iltalehti — PS:n kansanedustaja kokoomusministerin kimpussa (byline)",
  },
  {
    slug: "rami-makinen", name: "Rami Mäkinen", subtype: "POLITICS_REPORTER",
    outlet: "iltalehti", currentRole: "Politiikan toimittaja", specialties: ["politiikka", "eduskunta", "puolueet"],
    topics: ["politiikka", "vaalit"],
    sourceUrl: "https://www.iltalehti.fi/politiikka",
    sourceName: "Iltalehti — Politiikka-osaston toimittajan julkinen tehtävä",
  },
  {
    slug: "jari-korkki", name: "Jari Korkki", subtype: "COLUMNIST",
    outlet: "iltalehti", currentRole: "Poliittinen kolumnisti / toimittaja", specialties: ["politiikka", "yhteiskunta"],
    topics: ["politiikka", "yhteiskunta"],
    sourceUrl: "https://www.iltalehti.fi/politiikka",
    sourceName: "Iltalehti — Politiikka-osaston kolumnistin julkinen tehtävä",
  },
  {
    slug: "kalle-silfverberg", name: "Kalle Silfverberg", subtype: "COLUMNIST",
    outlet: "hs", currentRole: "Talouskolumnisti / toimittaja", specialties: ["talous", "politiikka"],
    topics: ["talous", "politiikka"],
    sourceUrl: "https://www.hs.fi/politiikka",
    sourceName: "Helsingin Sanomat — Politiikka/talous-osaston kolumnistin julkinen tehtävä",
  },
  {
    slug: "elina-kervinen", name: "Elina Kervinen", subtype: "POLITICS_REPORTER",
    outlet: "hs", currentRole: "Politiikan toimittaja", specialties: ["politiikka", "eduskunta"],
    topics: ["politiikka"],
    sourceUrl: "https://www.hs.fi/politiikka",
    sourceName: "Helsingin Sanomat — Politiikka-osion toimittajan maininta (kirjoittaa politiikan toimittaja Elina Kervinen)",
  },
  {
    slug: "marko-junkkari", name: "Marko Junkkari", subtype: "POLITICS_REPORTER",
    outlet: "hs", currentRole: "Politiikan toimittaja", specialties: ["politiikka", "analyysi"],
    topics: ["politiikka", "analyysi"],
    sourceUrl: "https://www.hs.fi/politiikka",
    sourceName: "Helsingin Sanomat — Politiikka-osion toimittajan maininta (kirjoittaa HS:n politiikan toimittaja Marko Junkkari)",
  },
  {
    slug: "jarno-liski", name: "Jarno Liski", subtype: "POLITICS_REPORTER",
    outlet: "mtv", currentRole: "Politiikan toimittaja", specialties: ["politiikka", "eduskunta"],
    topics: ["politiikka"],
    sourceUrl: "https://www.mtvuutiset.fi",
    sourceName: "MTV Uutiset — Politiikan toimittajan julkinen tehtävä",
  },
];

// ---------------------------------------------------------------- articles (real RSS/listing data)

export const PILOT_ARTICLES: PilotArticle[] = [
  {
    outlet: "iltalehti",
    title: "Näkökulma: Äärioikeistolle murskavoitto – Saksassa tapahtui jotain, mitä ei ole nähty sitten vuoden 1945",
    url: "https://www.iltalehti.fi/ulkomaat/a/ba190b96-e4b4-4551-b8f6-d39ce74cdfa6",
    publishedAt: "2026-09-06T19:54:58+03:00",
    genre: "ANALYSIS",
    section: "ulkomaat",
    excerpt: "Saksi-Anhaltin osavaltiovaaleista itäisessä Saksassa on muodostunut äärioikeiston juhla.",
    topics: ["Saksa", "vaalit", "äärioikeisto"],
    authors: ["mikael-shepelenko"],
  },
  {
    outlet: "iltalehti",
    title: "Asiantuntijalta todella karu arvio Moskovan tapaamisesta: \u201CEi tässä ole tapahtunut mitään sellaista…\u201D",
    url: "https://www.iltalehti.fi/ulkomaat/a/8f7fd0a3-4819-45d5-a4cd-21bb02e68602",
    publishedAt: "2026-09-06T20:06:52+03:00",
    genre: "ANALYSIS",
    section: "ulkomaat",
    topics: ["Venäjä", "Yhdysvallat"],
    authors: ["mikael-shepelenko"],
  },
  {
    outlet: "iltalehti",
    title: "PS:n kansanedustaja kokoomusministerin kimpussa: \u201CSietämätöntä\u201D",
    url: "https://www.iltalehti.fi/politiikka/a/afe9db4c-142f-4b13-9631-e6af4deec323",
    publishedAt: "2026-09-06T16:46:45+03:00",
    genre: "NEWS",
    section: "politiikka",
    excerpt: "PS:n kansanedustaja Onni Rostila arvostelee rankoin sanakääntein hallituskumppani kokoomusta edustavaa sosiaaliturvaministeri Karoliina Partasta Facebookissa.",
    topics: ["eduskunta", "kokoomus", "perussuomalaiset"],
    authors: ["mika-koskinen"],
  },
  {
    outlet: "iltalehti",
    title: "Tarja Halonen tyrmää hallituksen toimet – \u201CVaikeuttaa yli 800\u202f000 suomalaisen elämää\u201D",
    url: "https://www.iltalehti.fi/politiikka/a/7ff33e11-96a1-486e-8924-324ae7433fda",
    publishedAt: "2026-09-06T18:44:56+03:00",
    genre: "NEWS",
    section: "politiikka",
    topics: ["hallitus", "hyvinvointi", "leikkaukset"],
  },
  {
    outlet: "iltalehti",
    title: "Trumpin poika Tallinnassa – Syystä vaietaan",
    url: "https://www.iltalehti.fi/ulkomaat/a/59084d60-234a-483b-8e4e-b48ab31fa836",
    publishedAt: "2026-09-06T16:49:13+03:00",
    genre: "NEWS",
    section: "ulkomaat",
    topics: ["Yhdysvallat", "Viro"],
  },
  {
    outlet: "iltalehti",
    title: "Axios: Tämä oli Kiovan neuvotteluiden tavoite – \u201CEnnen talvea\u201D",
    url: "https://www.iltalehti.fi/ulkomaat/a/758b4ebc-823a-4c47-9079-e5f67b44633b",
    publishedAt: "2026-01-23T10:22:41+02:00",
    genre: "NEWS",
    section: "ulkomaat",
    topics: ["Ukraina", "Venäjä"],
  },
  {
    outlet: "iltalehti",
    title: "Ajojahti alkoi Yhdysvaltain puolustusministeriössä – \u201CEnnen näkemätöntä\u201D",
    url: "https://www.iltalehti.fi/ulkomaat/a/8048699f-58bc-4910-aaf1-051b6d96a081",
    publishedAt: "2026-09-06T14:01:39+03:00",
    genre: "NEWS",
    section: "ulkomaat",
    topics: ["Yhdysvallat", "puolustus"],
  },
  {
    outlet: "iltalehti",
    title: "Suomeen sorvataan uutta veroa – Nyt tuli älähdys",
    url: "https://www.iltalehti.fi/kotimaa/a/72bcfd93-5519-4a6e-9826-c400fb292d82",
    publishedAt: "2026-09-06T18:37:33+03:00",
    genre: "NEWS",
    section: "kotimaa",
    topics: ["talous", "verotus"],
  },
  {
    outlet: "demokraatti",
    title: "Ville Skinnari: Kasvutilastoja pitää osata lukea – onko Suomi yhä oikeilla vientimarkkinoilla?",
    url: "https://demokraatti.fi/ville-skinnari-kasvutilastoja-pitaa-osata-lukea-onko-suomi-yha-oikeilla-vientimarkkinoilla/",
    publishedAt: "2026-09-03T17:01:23+03:00",
    genre: "ANALYSIS",
    section: "politiikka",
    topics: ["talous", "vienti", "SDP"],
  },
  {
    outlet: "demokraatti",
    title: "Stubb ihmetteli: Kansanedustajakin erehtyi jakamaan Venäjän propagandaa",
    url: "https://demokraatti.fi/stubb-ihmetteli-kansanedustajakin-erehtyi-jakamaan-venajan-propagandaa/",
    publishedAt: "2026-09-04T13:16:50+03:00",
    genre: "NEWS",
    section: "politiikka",
    topics: ["Venäjä", "sosiaalinen media"],
  },
  {
    outlet: "demokraatti",
    title: "Evp-upseeri: Otetaan mallia Saksasta – suljetaan Venäjän Ahvenanmaan konsulaatti",
    url: "https://demokraatti.fi/evp-upseeri-otetaan-mallia-saksasta-suljetaan-venajan-ahvenanmaan-konsulaatti/",
    publishedAt: "2026-09-04T06:35:03+03:00",
    genre: "ANALYSIS",
    section: "ulkomaat",
    topics: ["Venäjä", "Ahvenanmaa", "turvallisuus"],
  },
  {
    outlet: "demokraatti",
    title: "RKP ei ole tyytyväinen perussuomalaisten tapaan käsitellä Peltokankaan kirjoitukset",
    url: "https://demokraatti.fi/rkp-ei-ole-tyytyvainen-perussuomalaisten-tapaan-kasitella-peltokankaan-kirjoitukset/",
    publishedAt: "2026-09-03T13:58:24+03:00",
    genre: "NEWS",
    section: "politiikka",
    topics: ["RKP", "perussuomalaiset", "eduskunta"],
  },
];

// Eduskunnan virallinen puoluekanta-kartta — käytetään vain puolueen
// tunnistamiseen otsikosta (havainnoitu tieto), ei kannan väitteisiin.
export const PARTY_NAME_HINTS: Record<string, string> = {
  "KOK": "Kansallinen Kokoomus",
  "kokoomus": "Kansallinen Kokoomus",
  "SDP": "Suomen Sosialidemokraattinen Puolue",
  "demarit": "Suomen Sosialidemokraattinen Puolue",
  "KESK": "Suomen Keskusta",
  "keskusta": "Suomen Keskusta",
  "VIHR": "Vihreä liitto",
  "vihreät": "Vihreä liitto",
  "VAS": "Vasemmistoliitto",
  "vasemmistoliitto": "Vasemmistoliitto",
  "RKP": "Suomen ruotsalainen kansanpuolue",
  "perussuomalaiset": "Perussuomalaiset",
  "PS": "Perussuomalaiset",
  "KD": "Suomen Kristillisdemokraatit",
  "Liike Nyt": "Liike Nyt",
};