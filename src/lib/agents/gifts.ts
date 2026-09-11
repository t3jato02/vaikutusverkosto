// GiftAndBenefitAgent — gifts, hospitality, portraits & other benefits (section 6-8).
//
// This is a *capability* agent: it provides the deterministic ingestion path
// for documented benefit events. The manifest below is deliberately EMPTY —
// no benefit event is included without a credible public source (section 30:
// "No sufficiently reliable source found" is preferable to fabricating an
// edge). Operators append source-backed rows here (each with a real evidence
// URL) and the agent ingests them into the review queue; nothing is
// auto-published unless the source is an official register and the value
// EXACT (see publish.ts auto-publish policy).
//
// When a row IS added, the review queue lets an admin approve/reject with a
// full audit trail, and the international-gift model is generic: the parties
// can be any entity (foreign president, embassy, government, royal household,
// Finnish state, president, minister, MP, official, organisation).

import { SourceType } from "@prisma/client";
import type { AgentFact, SourceAdapter } from "./types";
import type { BenefitEventFact } from "./types";

// ---------------------------------------------------------------------------
// Manifest. Each row must carry: eventType, title, parties, evidenceUrl,
// sourceName, valuePrecision and a stable dedupeKey.
//
// Example (a documented, sourced case — DO NOT uncomment without a source):
// {
//   kind: "benefit",
//   eventType: "HOSPITALITY",
//   title: "...",
//   description: "...",
//   giver: { type: "GOVERNMENT_BODY", name: "..." },
//   recipient: { type: "PERSON", name: "..." },
//   eventDate: new Date(Date.UTC(2024, 5, 1)),
//   valueType: "UNKNOWN",
//   confidence: "HIGH",
//   evidenceUrl: "https://...",
//   sourceType: SourceType.REPUTABLE_MEDIA,
//   sourceName: "...",
//   publisher: "...",
//   extractionMethod: "deterministic-parser",
//   evidenceGrade: "B",
//   dedupeKey: "gift:...",
// }
// ---------------------------------------------------------------------------
const MANIFEST: BenefitEventFact[] = [];

export const giftBenefitAdapter: SourceAdapter = {
  id: "gift-benefit-agent",
  name: "Lahjat, edut, vieraanvaraisuus ja muotokuvat",
  sourceType: SourceType.REPUTABLE_MEDIA,
  schedule: "weekly",
  baseUrl: "https://yle.fi/aihe/about-yle",
  publisher: "Vaikutusverkosto (lähdeperustainen manifesti)",
  reliabilityTier: "REPUTABLE_MEDIA",
  format: "HTML",
  updateCadence: "weekly",
  notes:
    "Dokumentoitujen lahja-, etu-, vieraanvaraisuus- ja muotokuva-tapahtumien " +
    "ingestointikanava. Manifesti on tyhjä, kunnes yksittäiselle tapahtumalle " +
    "löytyy uskottava julkinen lähde. Kaikki rivit menevät tarkistusjonoon.",

  async discover(ctx) {
    ctx.log(`gift/benefit manifest: ${MANIFEST.length} documented events (${MANIFEST.length === 0 ? "no unsourced claims — see data file" : ""})`);
    if (MANIFEST.length === 0) return [];
    return [
      {
        id: "gift-benefit-manifest",
        url: "https://yle.fi/aihe/about-yle",
        title: "Lahja- ja etutapahtumat — lähdeperustainen manifesti",
        hash: `gift-benefit-v${MANIFEST.length}`,
        meta: {},
      },
    ];
  },

  async fetch(_ctx, _doc) {
    return { json: MANIFEST };
  },

  async parse(_ctx, _doc, raw) {
    const rows = (raw as { json?: BenefitEventFact[] }).json ?? [];
    return rows as AgentFact[];
  },
};