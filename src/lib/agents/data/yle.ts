// Yleisradio Oy — source-backed data manifest for the YleAgent.
//
// Every record below is backed by a real public source (see the per-record
// `url`). Figures are official Yle financial statements / annual reports or
// cited public records. Amounts are in EUR. Nothing here is inferred:
//   - 2020–2025 income/expenditure: Yle's official finances & annual report
//     pages (yle.fi/aihe) and the 2024 "Financial key figures" table.
//   - Leadership: Yle's official Board of Directors and Management Group pages
//     (yle.fi) and the Yleisradio Wikipedia leadership list.
//   - Ownership: official "This is Yle" page (99,98 % state) + VNK registry.
//
// Evidence grades: A = official yle.fi/authoritative record; B = strong
// secondary (Wikipedia list corroborated by yle.fi citations).
//
// When a figure cannot be sourced it is simply absent — the system shows
// "no sufficiently reliable source found" rather than fabricating a value.

export interface YleManifestSection {
  id: string; // document externalId
  url: string; // canonical evidence page
  title: string;
  data: unknown;
}

// ---------------------------------------------------------------- profile

export interface YleProfileSection {
  canonicalName: string;
  aliases: string[];
  description: string;
  subtype: string;
  officialUrl: string;
  legalForm: string;
  registrationNumber: string;
  foundingYear: number;
  headquarters: string;
  employeeCount: number;
  mediaOutletType: string;
  publishLanguages: string[];
  fundingModel: string;
  websiteUrl: string;
}

export const yleProfile: YleProfileSection = {
  canonicalName: "Yleisradio Oy",
  aliases: ["Yle", "Rundradion Ab", "Suomen Yleisradio"],
  description:
    "Yleisradio Oy (Yle) on Suomen valtion omistama, liikenne- ja viestintäministeriön hallinnonalainen " +
    "julkisen palvelun mediayhtiö. Toimintaa ohjaa laki Yleisradio Oy:stä. Rahoitus perustuu " +
    "yleisradioveron tuotosta maksettavaan valtion rahoitukseen; Yle ei kerää mainostuloja.",
  subtype: "MEDIA_OUTLET",
  officialUrl: "https://yle.fi/a/20-10009579",
  legalForm: "Osakeyhtiö",
  registrationNumber: "0215438-8",
  foundingYear: 1926,
  headquarters: "Helsinki",
  employeeCount: 2702, // 2025, permanent staff
  mediaOutletType: "BROADCASTER",
  publishLanguages: ["fi", "sv", "se", "en"],
  fundingModel: "Yle-vero (julkinen rahoitus)",
  websiteUrl: "https://yle.fi",
};

// ---------------------------------------------------------------- ownership

export interface YleOwnershipFact {
  ownerName: string;
  ownerType: string;
  ownerExternalId: { provider: string; identifier: string } | null;
  percent: number | null;
  url: string;
  sourceName: string;
  grade: "A" | "B";
}

export const yleOwnership: YleOwnershipFact[] = [
  {
    ownerName: "Suomen valtio",
    ownerType: "GOVERNMENT_BODY",
    ownerExternalId: { provider: "vnk", identifier: "suomen-valtio" },
    percent: 99.98,
    url: "https://yle.fi/a/20-10009579",
    sourceName: "Yle — This is Yle (yle.fi)",
    grade: "A",
  },
];

// ---------------------------------------------------------------- leadership

export interface YleLeadershipFact {
  name: string;
  role: string;
  since: number | null;
  until: number | null;
  current: boolean;
  relationshipType: "WORKS_FOR" | "BOARD_MEMBER_OF" | "CHAIRS";
  boardRole?: "hallituksen_puheenjohtaja" | "hallituksen_jasen" | "henkiloston_edustaja";
  url: string;
  sourceName: string;
  grade: "A" | "B";
}

// Toimitusjohtajat. Historical dates from the Wikipedia leadership list
// (corroborated by yle.fi references); current CEO from yle.fi.
export const yleCeos: YleLeadershipFact[] = [
  { name: "Arne Wessberg", role: "Toimitusjohtaja", since: 1994, until: 2005, current: false, relationshipType: "WORKS_FOR", url: "https://fi.wikipedia.org/wiki/Yleisradio", sourceName: "Wikipedia — Yleisradio (johtajat)", grade: "B" },
  { name: "Mikael Jungner", role: "Toimitusjohtaja", since: 2005, until: 2010, current: false, relationshipType: "WORKS_FOR", url: "https://fi.wikipedia.org/wiki/Yleisradio", sourceName: "Wikipedia — Yleisradio (johtajat)", grade: "B" },
  { name: "Lauri Kivinen", role: "Toimitusjohtaja", since: 2010, until: 2018, current: false, relationshipType: "WORKS_FOR", url: "https://fi.wikipedia.org/wiki/Yleisradio", sourceName: "Wikipedia — Yleisradio (johtajat)", grade: "B" },
  { name: "Merja Ylä-Anttila", role: "Toimitusjohtaja", since: 2018, until: 2025, current: false, relationshipType: "WORKS_FOR", url: "https://fi.wikipedia.org/wiki/Yleisradio", sourceName: "Wikipedia — Yleisradio (johtajat)", grade: "B" },
  { name: "Marit af Björkesten", role: "Toimitusjohtaja", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/a/20-10009579", sourceName: "Yle — This is Yle (yle.fi)", grade: "A" },
];

// Hallitus (board). Official Yle Board of Directors page.
export const yleBoard: YleLeadershipFact[] = [
  { name: "Kari Kivelä", role: "Hallituksen puheenjohtaja", since: 2026, until: null, current: true, relationshipType: "CHAIRS", boardRole: "hallituksen_puheenjohtaja", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Hannakaisa Länsisalmi", role: "Hallituksen jäsen", since: 2023, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Mikko Alatalo", role: "Hallituksen jäsen", since: 2022, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Kaarina Gould", role: "Hallituksen jäsen", since: 2022, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Salla Ketola", role: "Hallituksen jäsen", since: 2026, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Frank Korsström", role: "Hallituksen jäsen", since: 2026, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Elina Piispanen", role: "Hallituksen jäsen", since: 2024, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "hallituksen_jasen", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
  { name: "Antti Laakso", role: "Hallituksen henkilöstön edustaja", since: 2026, until: null, current: true, relationshipType: "BOARD_MEMBER_OF", boardRole: "henkiloston_edustaja", url: "https://yle.fi/a/20-290857", sourceName: "Yle — Board of Directors (yle.fi)", grade: "A" },
];

// Johtoryhmä (management group). Official Yle CEO & Management Group page.
export const yleManagement: YleLeadershipFact[] = [
  { name: "Marit af Björkesten", role: "Toimitusjohtaja", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Janne Yli-Äyhö", role: "Teknologiajohtaja (CTO), toimitusjohtajan sijainen", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Jyrki Rosenberg", role: "Media-johtaja", since: 2026, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Krista Taubert", role: "Uutis- ja urheilujohtaja (vt.)", since: 2026, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Johanna Törn-Mangs", role: "Kulttuuri- ja asiasisältöjen johtaja", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Anna Forth", role: "Svenska Ylen johtaja", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Laura Ansaharju", role: "Henkilöstö- ja kestävyysjohtaja (CHRO)", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Jere Nurminen", role: "Viestintä-, brändi- ja markkinointijohtaja", since: 2025, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
  { name: "Maisa Hyrkkänen", role: "Talousjohtaja (CFO)", since: 2019, until: null, current: true, relationshipType: "WORKS_FOR", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", sourceName: "Yle — CEO and Management Group (yle.fi)", grade: "A" },
];

// ---------------------------------------------------------------- governance

export interface YleGovernanceFact {
  councilName: string;
  councilType: string;
  oversights: string; // canonical Yle name
  chairmanName: string | null;
  viceChairmanName: string | null;
  url: string;
  sourceName: string;
  grade: "A" | "B";
  memberCount: number;
}

// Hallintoneuvosto — 21 MPs chosen by the Eduskunta. Member edges are
// maintained by the parliament agent; the Yle agent links the council to Yle.
export const yleGovernance: YleGovernanceFact = {
  councilName: "Yleisradio Oy:n hallintoneuvosto",
  councilType: "ORGANIZATION",
  oversights: "Yleisradio Oy",
  chairmanName: "Sinuhe Wallinheimo",
  viceChairmanName: "Jari Ronkainen",
  url: "https://fi.wikipedia.org/wiki/Yleisradion_hallintoneuvosto",
  sourceName: "Wikipedia — Yleisradion hallintoneuvosto",
  grade: "B",
  memberCount: 21,
};

// ---------------------------------------------------------------- finances

export interface YleStatementFact {
  year: number;
  kind: "INCOME" | "EXPENDITURE";
  category: string;
  categoryLabel: string;
  amountEur: number;
  valueType: "EXACT" | "REPORTED" | "CALCULATED" | "ESTIMATED" | "UNKNOWN";
  isTotal?: boolean;
  note?: string;
  url: string;
  sourceName: string;
  publicationDate?: string;
}

export interface YleFlowFact {
  year: number;
  amountEur: number;
  purpose: string;
  valueType: "EXACT" | "REPORTED" | "CALCULATED" | "ESTIMATED" | "UNKNOWN";
  url: string;
  sourceName: string;
}

const M = 1_000_000;

export const yleFinances: { docId: string; url: string; title: string; items: YleStatementFact[]; flows: YleFlowFact[] }[] = [
  {
    docId: "yle-finances-2025",
    url: "https://yle.fi/a/20-10009541",
    title: "Yle's finances 2025 — yle.fi",
    items: [
      { year: 2025, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 548.2 * M, valueType: "EXACT", isTotal: true, note: "Yle-veropohjaisen rahoituksen osuus 98,4 %. Liikevaihto 545 M€, liikevoitto 17 M€.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "INCOME", category: "YLE_APPROPRIATION", categoryLabel: "Valtion rahoitus (Yle-vero)", amountEur: 539_428_800, valueType: "CALCULATED", note: "98,4 % tuotoista (lähde ilmoittaa osuuden, summa johdettu).", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 528.9 * M, valueType: "EXACT", isTotal: true, url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PERSONNEL_COSTS", categoryLabel: "Henkilöstökulut", amountEur: 262.1 * M, valueType: "EXACT", note: "49,5 % kuluista. Vakituisia työsuhteita 2 702, henkilötyövuosia keskimäärin 3 063. Palkat 188,0, palkkiot 8,2, eläkkeet 59,3, muut sivukulut 6,6 M€.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PERSONNEL_WAGES", categoryLabel: "Palkat", amountEur: 188.0 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PERSONNEL_FEES", categoryLabel: "Palkkiot", amountEur: 8.2 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PERSONNEL_PENSIONS", categoryLabel: "Eläkekulut", amountEur: 59.3 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PERSONNEL_OTHER", categoryLabel: "Muut henkilöstösivukulut", amountEur: 6.6 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "RIGHTS_COSTS", categoryLabel: "Lähetysoikeudet", amountEur: 68.0 * M, valueType: "EXACT", note: "Kotimaiset 42,0 ja ulkomaiset/urheiluoikeudet 26,0 M€.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "RIGHTS_DOMESTIC", categoryLabel: "Kotimaiset oikeudet", amountEur: 42.0 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "RIGHTS_FOREIGN", categoryLabel: "Ulkomaiset ja urheiluoikeudet", amountEur: 26.0 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "DEPRECIATION", categoryLabel: "Poistot", amountEur: 21.2 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PROGRAMME_COSTS", categoryLabel: "Ohjelmatoiminnan kulut", amountEur: 58.0 * M, valueType: "EXACT", note: "Musiikin esityskorvaukset 25,1, muut lähetyspalkkiot 11,7, tuotantopalvelut 13,4, muut palvelut 6,5, tarvikkeet 1,3 M€.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "MUSIC_FEES", categoryLabel: "Musiikin esityskorvaukset", amountEur: 25.1 * M, valueType: "EXACT", note: "Maksettu Teostolle ja Gramexille; Yle on suurin yksittäinen Teoston maksaja.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "DISTRIBUTION_COSTS", categoryLabel: "Jakelukulut", amountEur: 28.4 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "TECHNOLOGY_COSTS", categoryLabel: "Teknologiakulut", amountEur: 41.9 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "PROPERTY_COSTS", categoryLabel: "Vuokrat ja kiinteistökulut", amountEur: 23.6 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "OTHER_EXPENSES", categoryLabel: "Muut kulut", amountEur: 25.7 * M, valueType: "EXACT", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "CONTENT_PURCHASES", categoryLabel: "Sisältö- ja ohjelmapalveluhankinnat", amountEur: 98.7 * M, valueType: "EXACT", note: "Kotimaiset lähetysoikeudet 42,0, rojaltit 11,7, musiikin esityskorvaukset 25,1 ja muut ohjelmapalvelut 19,9 M€.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "FREELANCER_FEES", categoryLabel: "Freelancerpalkkiot", amountEur: 9.3 * M, valueType: "EXACT", note: "Yle työllisti 2 872 luovan alan freelanceria.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
      { year: 2025, kind: "EXPENDITURE", category: "TAX_FOOTPRINT", categoryLabel: "Verokertymävaikutus", amountEur: 124.9 * M, valueType: "EXACT", note: "Ennakonpidätykset, lakisääteiset työnantajamaksut, arvonlisävero, kiinteistö- ja muut verot.", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)", publicationDate: "2026-03-01" },
    ],
    flows: [
      { year: 2025, amountEur: 539_428_800, purpose: "Valtion rahoitus Yleisradioveron tuotosta (98,4 % tuotoista; osuus ilmoitettu, summa johdettu)", valueType: "CALCULATED", url: "https://yle.fi/a/20-10009541", sourceName: "Yle — Finances 2025 (yle.fi)" },
    ],
  },
  {
    docId: "yle-finances-2024",
    url: "https://yle.fi/aihe/a/20-10008479",
    title: "Financial figures 2024 — Yle's year 2024 (yle.fi)",
    items: [
      { year: 2024, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 548.4 * M, valueType: "EXACT", isTotal: true, note: "Liikevaihto 546,0 + muut toimintatuotot 2,4 M€. Yle-veron osuus 98,4 %.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "INCOME", category: "YLE_APPROPRIATION", categoryLabel: "Valtion rahoitus (Yle-vero)", amountEur: 539.7 * M, valueType: "EXACT", note: "Yle-määräraha 539,7 M€ (tuloslaskelma).", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "INCOME", category: "OTHER_INCOME", categoryLabel: "Muut tuotot", amountEur: 8.7 * M, valueType: "EXACT", note: "Muut toimintatuotot 6,3 + muut liiketoiminnan tuotot 2,4 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 549.2 * M, valueType: "EXACT", isTotal: true, note: "Kategoriaerien summa poikkeaa pyöristyksestä johtuen (~548,8 M€).", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PERSONNEL_COSTS", categoryLabel: "Henkilöstökulut", amountEur: 255.4 * M, valueType: "EXACT", note: "46,5 % kuluista. Vakituisia työsuhteita 2 830, henkilötyövuosia keskimäärin 3 343.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PERSONNEL_WAGES", categoryLabel: "Palkat", amountEur: 202.5 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PERSONNEL_FEES", categoryLabel: "Palkkiot", amountEur: 9.9 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PERSONNEL_PENSIONS", categoryLabel: "Eläkekulut", amountEur: 37.9 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PERSONNEL_OTHER", categoryLabel: "Muut henkilöstösivukulut", amountEur: 5.2 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "RIGHTS_COSTS", categoryLabel: "Lähetysoikeudet", amountEur: 75.6 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "RIGHTS_DOMESTIC", categoryLabel: "Kotimaiset oikeudet", amountEur: 37.1 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "RIGHTS_FOREIGN", categoryLabel: "Ulkomaiset ja urheiluoikeudet", amountEur: 38.5 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "DEPRECIATION", categoryLabel: "Poistot", amountEur: 18.6 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PROGRAMME_COSTS", categoryLabel: "Ohjelmatoiminnan kulut", amountEur: 64.8 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "MUSIC_FEES", categoryLabel: "Musiikin esityskorvaukset", amountEur: 25.3 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "DISTRIBUTION_COSTS", categoryLabel: "Jakelukulut", amountEur: 31.5 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "TECHNOLOGY_COSTS", categoryLabel: "Teknologiakulut", amountEur: 46.4 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "PROPERTY_COSTS", categoryLabel: "Vuokrat ja kiinteistökulut", amountEur: 24.1 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "OTHER_EXPENSES", categoryLabel: "Muut kulut", amountEur: 32.9 * M, valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "CONTENT_PURCHASES", categoryLabel: "Sisältö- ja ohjelmapalveluhankinnat", amountEur: 100.2 * M, valueType: "EXACT", note: "Kotimaiset lähetysoikeudet 37,1, rojaltit 13,7, musiikin esityskorvaukset 25,3 ja muut ohjelmapalvelut 24,1 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2024, kind: "EXPENDITURE", category: "FREELANCER_FEES", categoryLabel: "Freelancerpalkkiot", amountEur: 12.0 * M, valueType: "EXACT", note: "Yle työllisti 4 085 luovan alan freelanceria.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
    ],
    flows: [
      { year: 2024, amountEur: 539.7 * M, purpose: "Valtion rahoitus Yleisradioveron tuotosta (Yle-määräraha)", valueType: "EXACT", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)" },
    ],
  },
  {
    docId: "yle-finances-2023",
    url: "https://yle.fi/aihe/a/20-10008479",
    title: "Financial figures 2024 (2020–2023 time series) — Yle (yle.fi)",
    items: [
      { year: 2023, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 529.6 * M, valueType: "EXACT", isTotal: true, note: "Liikevaihto 527,3 + muut toimintatuotot 2,3 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2023, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 525.3 * M, valueType: "EXACT", isTotal: true, url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial figures 2024 (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2022, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 514.1 * M, valueType: "EXACT", isTotal: true, note: "Liikevaihto 511,8 + muut toimintatuotot 2,3 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2022, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 516.7 * M, valueType: "EXACT", isTotal: true, note: "Kustannukset ja poistot (lähdetaulukko).", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2021, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 502.5 * M, valueType: "EXACT", isTotal: true, note: "Liikevaihto 499,9 + muut toimintatuotot 2,6 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2021, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 508.2 * M, valueType: "EXACT", isTotal: true, note: "Kustannukset ja poistot (lähdetaulukko).", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2020, kind: "INCOME", category: "TOTAL_INCOME", categoryLabel: "Tuotot yhteensä", amountEur: 490.2 * M, valueType: "EXACT", isTotal: true, note: "Liikevaihto 487,6 + muut toimintatuotot 2,6 M€.", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
      { year: 2020, kind: "EXPENDITURE", category: "TOTAL_EXPENSES", categoryLabel: "Kulut yhteensä", amountEur: 481.4 * M, valueType: "EXACT", isTotal: true, note: "Kustannukset ja poistot (lähdetaulukko).", url: "https://yle.fi/aihe/a/20-10008479", sourceName: "Yle — Financial key figures (yle.fi)", publicationDate: "2025-03-01" },
    ],
    flows: [],
  },
];

// Yle is a major funder of the creative sector — a documented aggregate
// "Yle → freelancers" figure (2024/2025) is already a statement item above.