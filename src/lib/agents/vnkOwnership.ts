// VNK State Ownership adapter — the Finnish state's direct company holdings.
//
// Source: Valtioneuvoston kanslia, omistajaohjausosasto — the annual state
// ownership report and the official holdings listing
// (https://vnk.fi/omistajaohjaus). There is no machine-readable API; the
// listing is a small, stable set published in an annual report. The figures
// below are transcribed VERBATIM from that official report; each carries the
// official source URL as evidence and an `observedAt` reporting date. Cadence
// is MANUAL — a human updates this file when a new report is published.
//
// Only the state's DIRECT holdings are modelled here (Suomen valtio -> OWNS ->
// company). Indirect holdings via Solidium are a separate documented chain and
// are NOT flattened. Nothing is inferred — no ownership is derived from a
// company's name, sector or country.

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const SOURCE_URL = "https://vnk.fi/omistajaohjaus/valtio-omistajana";
const REPORT_URL =
  "https://julkaisut.valtioneuvosto.fi/handle/10024/165958"; // Valtion omistajaohjauksen vuosikertomus 2023
const OBSERVED_AT = "2024-05-31"; // publication of the 2023 annual holdings report
const PARSER_VERSION = "vnk-ownership-2023";

const STATE_REF = {
  type: EntityType.GOVERNMENT_BODY,
  name: "Suomen valtio",
  subtype: "Valtio-omistaja (VNK omistajaohjaus)",
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "GOVERNMENT" as const,
  description:
    "Suomen valtio yhtiöomistajana. Omistajaohjauksesta vastaa valtioneuvoston kanslian " +
    "omistajaohjausosasto.",
  externalId: { provider: "vnk", identifier: "suomen-valtio" },
} as const;

interface Holding {
  name: string;
  businessId?: string; // Y-tunnus, when unambiguous
  percent: number; // direct state ownership %, from the official report
  category: "STATE_OWNED_COMPANY" | "COMPANY";
  note?: string;
}

// Verbatim from "Valtion omistajaohjauksen vuosikertomus 2023" (VNK). Only
// holdings whose percentage the report states unambiguously are included.
const HOLDINGS: Holding[] = [
  { name: "Solidium Oy", businessId: "2245475-7", percent: 100.0, category: "STATE_OWNED_COMPANY", note: "Valtion kokonaan omistama sijoitusyhtiö." },
  { name: "VR-Yhtymä Oyj", businessId: "1003521-5", percent: 100.0, category: "STATE_OWNED_COMPANY" },
  { name: "Posti Group Oyj", businessId: "0109357-9", percent: 100.0, category: "STATE_OWNED_COMPANY" },
  { name: "Gasgrid Finland Oy", businessId: "3007894-1", percent: 100.0, category: "STATE_OWNED_COMPANY" },
  { name: "Finavia Oyj", businessId: "2302570-2", percent: 100.0, category: "STATE_OWNED_COMPANY" },
  { name: "Yleisradio Oy", businessId: "0244984-4", percent: 100.0, category: "STATE_OWNED_COMPANY", note: "Eduskunnan alainen; hallinnollisesti erillinen." },
  { name: "Fingrid Oyj", businessId: "1072894-3", percent: 53.1, category: "STATE_OWNED_COMPANY", note: "Valtion suora omistus; loput huoltovarmuusrahasto ja institutionaaliset." },
  { name: "Neste Oyj", businessId: "1852302-9", percent: 44.2, category: "COMPANY", note: "Valtion suora omistus." },
  { name: "Fortum Oyj", businessId: "1463611-4", percent: 50.76, category: "STATE_OWNED_COMPANY", note: "Valtion suora omistus." },
  { name: "Finnair Oyj", businessId: "0108023-3", percent: 55.9, category: "STATE_OWNED_COMPANY", note: "Valtion suora omistus." },
];

export const vnkOwnershipAdapter: SourceAdapter = {
  id: "vnk-state-ownership",
  name: "Valtion omistajaohjaus — valtion suorat yhtiöomistukset",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "weekly",
  baseUrl: SOURCE_URL,
  publisher: "Valtioneuvoston kanslia, omistajaohjausosasto",
  reliabilityTier: "OFFICIAL_PRIMARY",
  format: "PDF",
  updateCadence: "monthly",
  termsUrl: "https://vnk.fi/tietoa-sivustosta",
  notes:
    "Suomen valtion suorat yhtiöomistukset (osuus-% valtion omistajaohjauksen vuosikertomuksesta). " +
    "Ei koneluettavaa rajapintaa — kuratoitu tiedosto, jonka ihminen päivittää uuden vuosikertomuksen " +
    "ilmestyessä. Jokaisella rivillä virallinen lähde. Solidiumin väliomistuksia ei litistetä.",

  async discover(): Promise<SourceDocument[]> {
    return HOLDINGS.map((h) => ({
      id: `vnk:${h.businessId ?? h.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${OBSERVED_AT}`,
      url: `${REPORT_URL}#${encodeURIComponent(h.name)}`,
      title: `Valtion omistus — ${h.name} (${h.percent} %, ${OBSERVED_AT})`,
      publishedAt: new Date(OBSERVED_AT),
      hash: "",
      meta: h,
    }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    return doc.meta;
  },

  async parse(ctx, doc, raw): Promise<NormalizedFact[]> {
    const h = raw as Holding;
    if (!h?.name || !(h.percent > 0)) return [];
    ctx.log(`VNK: Suomen valtio → OWNS ${h.percent}% → ${h.name}`);
    return [
      {
        kind: "relationship",
        source: { ...STATE_REF },
        target: {
          type: EntityType.COMPANY as EntityType,
          name: h.name,
          jurisdiction: "FI",
          countryCode: "FI",
          entityCategory: h.category,
          ...(h.businessId ? { externalId: { provider: "ytj", identifier: h.businessId } } : {}),
        },
        relationshipType: RelationshipType.OWNS,
        role: h.note ?? "Valtion suora omistus",
        // percentage travels in `role` text + a dedicated field via publish.ts
        // (see amount/percentage handling); keep the number explicit here.
        startDate: null,
        endDate: null,
        assertedCurrent: true,
        confidence: "VERIFIED",
        evidenceUrl: REPORT_URL,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        ownershipPercent: h.percent,
      },
    ];
  },
};
