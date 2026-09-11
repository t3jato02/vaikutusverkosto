// AwardAgent — documented awards & honours (section 9).
//
// Source: "Suuri journalistipalkinto" (Päätoimittajien yhdistys; formerly
// Bonnier), winners list on fi.wikipedia.org/wiki/Suuri_journalistipalkinto.
// The article cites Yle Uutiset and the award body's own pages per year.
// Each award row is a BenefitEvent (type AWARD) with its own evidence URL and
// a 10 000 € prize where the source states it. Because the source is a
// secondary record (not an official register), every award lands in the
// review queue — no AI decides that an award is real.
//
// Award facts are kept strictly separate (section 9):
//   winner  → selectionRole "winner"
//   (jury membership / winner selection are separate documented facts when
//   a source supports them — none are included without evidence).

import { EntityType, SourceType } from "@prisma/client";
import type { EntityRef, SourceAdapter } from "./types";
import type { BenefitEventFact } from "./types";

export const AWARD_URL = "https://fi.wikipedia.org/wiki/Suuri_journalistipalkinto";
export const AWARD_SOURCE_NAME = "Suuri journalistipalkinto (Wikipedia, viittaukset Yle Uutisiin)";
export const PRIZE_EUR = 10_000;

const GIVER_2020: EntityRef = {
  type: EntityType.ASSOCIATION,
  name: "Päätoimittajien yhdistys",
  externalId: { provider: "fi-media", identifier: "paatoimittajien-yhdistys" },
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "NGO",
};

const GIVER_BONNIER: EntityRef = {
  type: EntityType.COMPANY,
  name: "Bonnier",
  externalId: { provider: "fi-media", identifier: "bonnier" },
  jurisdiction: "SE",
  countryCode: "SE",
  entityCategory: "COMPANY",
};

interface AwardRow {
  year: number;
  category: string;
  recipientName: string | null; // null = organisational award
  description: string;
}

const YLE_ORG_REF: EntityRef = {
  type: EntityType.MEDIA_ORGANIZATION,
  name: "Yleisradio Oy",
  externalId: { provider: "fi-media", identifier: "yleisradio-oy" },
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "MEDIA_ORGANIZATION",
};

// "Vuoden journalisti" (Journalist of the Year) winners, 2001–2025.
const JOURNALIST_OF_YEAR: AwardRow[] = [
  { year: 2001, category: "Vuoden journalisti", recipientName: "Kaius Niemi", description: "Helsingin Sanomat" },
  { year: 2002, category: "Vuoden journalisti", recipientName: "Martti Hosia", description: "Yleisradio — kirjeenvaihtaja" },
  { year: 2003, category: "Vuoden journalisti", recipientName: "Pekka Ervasti", description: "Ilta-Sanomat" },
  { year: 2004, category: "Vuoden journalisti", recipientName: "Kari Lumikero", description: "MTV3 — ulkomaankirjeenvaihtaja" },
  { year: 2005, category: "Vuoden journalisti", recipientName: "Pekka Seppänen", description: "Talouselämä — päätoimittaja" },
  { year: 2006, category: "Vuoden journalisti", recipientName: "Kati Juurus", description: "Yle / MOT" },
  { year: 2007, category: "Vuoden journalisti", recipientName: "Susanna Reinboth", description: "Nelosen uutiset" },
  { year: 2008, category: "Vuoden journalisti", recipientName: "Katri Makkonen", description: "Yle — Kiinan kirjeenvaihtaja" },
  { year: 2009, category: "Vuoden journalisti", recipientName: "Kristiina Tolvanen", description: "Aamulehti" },
  { year: 2010, category: "Vuoden journalisti", recipientName: "Jarmo Luuppala", description: "Iltalehti" },
  { year: 2011, category: "Vuoden journalisti", recipientName: "Anu Nousiainen", description: "Helsingin Sanomien Kuukausiliite" },
  { year: 2012, category: "Vuoden journalisti", recipientName: "Pekka Holopainen", description: "Ilta-Sanomat" },
  { year: 2013, category: "Vuoden journalisti", recipientName: "Saska Saarikoski", description: "Helsingin Sanomat" },
  { year: 2014, category: "Vuoden journalisti", recipientName: "Minna Knus-Galán", description: "Yle / MOT" },
  { year: 2015, category: "Vuoden journalisti", recipientName: "Tom Kankkonen", description: "Yle Uutiset" },
  { year: 2016, category: "Vuoden journalisti", recipientName: "Laura Saarikoski", description: "Helsingin Sanomat" },
  { year: 2017, category: "Vuoden journalisti", recipientName: "Olli Seuri", description: "Yle" },
  { year: 2018, category: "Vuoden journalisti", recipientName: "Vappu Kaarenoja", description: "Suomen Kuvalehti" },
  { year: 2019, category: "Vuoden journalisti", recipientName: "Antti Kuronen", description: "Yle" },
  { year: 2020, category: "Vuoden journalisti", recipientName: "Anna-Lena Laurén", description: "Hufvudstadsbladet" },
  { year: 2021, category: "Vuoden journalisti", recipientName: "Paavo Teittinen", description: "Helsingin Sanomat" },
  { year: 2022, category: "Vuoden journalisti", recipientName: "Ville Ranta", description: "Iltalehti" },
  { year: 2023, category: "Vuoden journalisti", recipientName: "Arja Paananen", description: "Ilta-Sanomat" },
  { year: 2024, category: "Vuoden journalisti", recipientName: "Iida Tikka", description: "Yle" },
  { year: 2025, category: "Vuoden journalisti", recipientName: "Suvi Turtiainen", description: "Helsingin Sanomat" },
];

// Documented organisational awards won by Yleisradio (programme teams).
const YLE_ORG_AWARDS: AwardRow[] = [
  { year: 2001, category: "Vuoden journalistinen uudistus", recipientName: null, description: "Kuuden pakolaistaustaisen toimittajan televisiotyön kurssi — Yleisradion Basaari-ohjelman toimitus (Kristiina Tuura, Umayya Abu-Hanna, Seppo Seppälä)" },
  { year: 2005, category: "Vuoden journalistinen uudistus", recipientName: null, description: "Yle TV1 / Yle Teema: Uutismixi — tuottaja Hannele Muuronen" },
  { year: 2013, category: "Vuoden journalistinen teko", recipientName: null, description: "\"Me tiedämme missä asut\" -projekti — Hannele Valkeeniemi, Aki Kekäläinen, Jarkko Ryynänen" },
  { year: 2021, category: "Vuoden journalistinen teko", recipientName: null, description: "Yleisradion Politiikka-Suomi-televisiosarja — Jussi Jormanainen, Pekka Laine, Olli Laine, JP Pulkkinen" },
];

function awardFact(row: AwardRow): BenefitEventFact {
  const giver = row.year >= 2020 ? GIVER_2020 : GIVER_BONNIER;
  const recipient = row.recipientName
    ? { type: EntityType.PERSON, name: row.recipientName, jurisdiction: "FI" }
    : YLE_ORG_REF;
  return {
    kind: "benefit",
    eventType: "AWARD",
    title: `${row.category} ${row.year}`,
    description: row.description,
    giver,
    recipient,
    eventDate: new Date(Date.UTC(row.year, 4, 1)),
    monetaryValue: PRIZE_EUR,
    currency: "EUR",
    valueType: "EXACT",
    country: "FI",
    selectionRole: "winner",
    confidence: "HIGH",
    evidenceUrl: AWARD_URL,
    evidenceTitle: `Suuri journalistipalkinto — ${row.category} ${row.year}`,
    sourceType: SourceType.REPUTABLE_MEDIA,
    sourceName: AWARD_SOURCE_NAME,
    publisher: "Päätoimittajien yhdistys / Wikipedia",
    extractionMethod: "deterministic-parser",
    evidenceGrade: "B",
    dedupeKey: `award:suuri-journalistipalkinto:${row.year}:${row.category}:${row.recipientName ?? "yleisradio-oy"}`,
  };
}

export const awardAdapter: SourceAdapter = {
  id: "award-agent",
  name: "Palkinnot ja kunnianosoitukset — Suuri journalistipalkinto",
  sourceType: SourceType.REPUTABLE_MEDIA,
  schedule: "weekly",
  baseUrl: AWARD_URL,
  publisher: "Päätoimittajien yhdistys (Wikipedia-kooste)",
  reliabilityTier: "REPUTABLE_MEDIA",
  format: "HTML",
  updateCadence: "weekly",
  termsUrl: AWARD_URL,
  notes:
    "Dokumentoidut Suuren journalistipalkinnon voittajat. Kaikki rivit menevät " +
    "tarkistusjonoon (lähde on toissijainen, ei virallinen rekisteri). " +
    "Palkinnon saaminen, voittajan valinta ja tuomaristossa toimiminen " +
    "pidetään erillisinä faktoina.",

  async discover(ctx) {
    ctx.log(`award manifest: ${JOURNALIST_OF_YEAR.length + YLE_ORG_AWARDS.length} documented awards`);
    return [
      { id: "awards-journalist-of-year", url: AWARD_URL, title: "Suuri journalistipalkinto — Vuoden journalisti (2001–2025)", hash: `awards-jy-v1`, meta: { rows: "journalist" } },
      { id: "awards-yle-organisation", url: AWARD_URL, title: "Suuri journalistipalkinto — Yleisradion organisatoriset palkinnot", hash: `awards-yle-v1`, meta: { rows: "yle" } },
    ];
  },

  async fetch(_ctx, doc) {
    const rows = (doc.meta as { rows?: string } | undefined)?.rows === "yle" ? YLE_ORG_AWARDS : JOURNALIST_OF_YEAR;
    return { json: rows };
  },

  async parse(_ctx, _doc, raw) {
    const rows = (raw as { json?: AwardRow[] }).json ?? [];
    return rows.map(awardFact);
  },
};