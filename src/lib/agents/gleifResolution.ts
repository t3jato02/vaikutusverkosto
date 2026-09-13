// GLEIFResolutionAgent — resolves legal entities via the GLEIF Legal Entity
// Identifier (LEI), maps aliases and BIC/SWIFT codes, and records public
// parent-child consolidation relationships where GLEIF documents them.
//
// GLEIF is SUPPORTING evidence, never a replacement for the organisation's own
// governance sources: governance roles and ownership percentages come from the
// FinanceInstitutionAgent / PensionGovernanceAgent manifests and official
// pages. This adapter maps identity deterministically.
//
// Runtime: manifest-driven by default (deterministic, Vercel-safe). Setting
// GLEIF_LIVE=1 makes fetch() overlay the GLEIF API records for each LEI,
// falling back to the manifest on any network error.

import { RelationshipType, SourceType } from "@prisma/client";
import type { AgentFact, EntityRef, ExternalIdentifierFact, NormalizedFact, SourceAdapter, SourceDocument } from "./types";
import { GLEIF_INDEX, GLEIF_SOURCE_URL, type GleifRecord } from "./data/gleif/gleifIndex";

const PARSER_VERSION = "gleif-resolution-1";

const PARENT_ROLE = "Konsernin emoyhtiö (dokumentoitu konsernisuhde)";

function entityRef(rec: GleifRecord): EntityRef {
  return {
    type: rec.entityType,
    name: rec.legalName,
    jurisdiction: rec.countryCode,
    countryCode: rec.countryCode,
    alias: rec.aliases?.[0] ?? null,
    externalId: { provider: "gleif-lei", identifier: rec.lei },
  };
}

/** Optional live GLEIF API overlay — only when GLEIF_LIVE=1. */
async function liveOverlay(rec: GleifRecord): Promise<GleifRecord> {
  if (process.env.GLEIF_LIVE !== "1") return rec;
  try {
    const url = `${GLEIF_SOURCE_URL}/${rec.lei}`;
    const res = await fetch(url);
    if (!res.ok) return rec;
    const data = (await res.json()) as {
      data?: { attributes?: { entity?: { legalName?: { name?: string } }; bic?: string[] } };
    };
    const attrs = data.data?.attributes;
    const liveName = attrs?.entity?.legalName?.name;
    if (liveName && liveName !== rec.legalName) {
      return { ...rec, legalName: liveName };
    }
    return rec;
  } catch {
    return rec;
  }
}

export const gleifResolutionAdapter: SourceAdapter = {
  id: "gleif-resolution-agent",
  name: "GLEIF-resoluutio — oikeushenkilöiden tunnistus (LEI), aliakset ja emoyhtiösuhteet",
  sourceType: SourceType.OFFICIAL_REGISTER,
  schedule: "weekly",
  baseUrl: GLEIF_SOURCE_URL,
  publisher: "GLEIF (Global Legal Entity Identifier Foundation)",
  reliabilityTier: "OFFICIAL_REGISTER",
  format: "API",
  updateCadence: "monthly",
  termsUrl: "https://www.gleif.org/en/aboutgleif/gleif-data-quality-management",
  notes:
    "Kuratoitu LEI-indeksi Suomen keskeisistä finanssilaitoksista ja niiden " +
    "dokumentoiduista emoyhtiöistä. GLEIF on TUKI-todiste: se kartoittaa " +
    "oikeushenkilön identiteetin, aliakset, BIC-koodin ja tallennetut " +
    "emoyhtiösuhteet — se ei korvaa yhtiön omia hallintolähteitä. Oletusarvoisesti " +
    "manifesti ajetaan paikallisesti (deterministinen, Vercel-yhteensopiva); " +
    "GLEIF_LIVE=1 kytkee päälle GLEIF-API:n reaaliaikaisen haun.",

  async discover(): Promise<SourceDocument[]> {
    return [
      {
        id: "gleif:index",
        url: GLEIF_SOURCE_URL,
        title: "GLEIF LEI-indeksi — finanssilaitokset ja emoyhtiöt",
        hash: "",
        meta: {},
      },
    ];
  },

  async fetch(_ctx, doc): Promise<unknown> {
    void doc;
    return Promise.all(GLEIF_INDEX.map(liveOverlay));
  },

  async parse(_ctx, _doc, raw): Promise<AgentFact[]> {
    const records = raw as GleifRecord[];
    const facts: AgentFact[] = [];
    const byLei = new Map(records.map((r) => [r.lei, r]));

    for (const rec of records) {
      const ref = entityRef(rec);
      // 1. LEI mapping + aliases (supporting identity evidence).
      facts.push({
        kind: "external-identifier",
        entity: ref,
        provider: "gleif-lei",
        identifier: rec.lei,
        aliases: rec.aliases ?? null,
        confidence: "HIGH",
        evidenceUrl: rec.sourceUrl,
        evidenceTitle: "GLEIF LEI-rekisteritietue",
        sourceType: SourceType.OFFICIAL_REGISTER,
        sourceName: "GLEIF",
        publisher: "GLEIF",
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        evidenceGrade: "A",
        dedupeKey: `gleif-lei:${rec.lei}`,
      } satisfies ExternalIdentifierFact);

      // 2. BIC mapping where available.
      if (rec.bic) {
        facts.push({
          kind: "external-identifier",
          entity: ref,
          provider: "swift-bic",
          identifier: rec.bic,
          confidence: "HIGH",
          evidenceUrl: rec.sourceUrl,
          evidenceTitle: "SWIFT/BIC-koodi",
          sourceType: SourceType.OFFICIAL_REGISTER,
          sourceName: "GLEIF",
          publisher: "GLEIF",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: "A",
          dedupeKey: `gleif-bic:${rec.lei}:${rec.bic}`,
        } satisfies ExternalIdentifierFact);
      }

      // 3. GLEIF-recorded parent-child consolidation.
      if (rec.parentLei) {
        const parent = byLei.get(rec.parentLei);
        if (!parent) continue;
        facts.push({
          kind: "relationship",
          source: ref,
          target: entityRef(parent),
          relationshipType: RelationshipType.PART_OF,
          role: PARENT_ROLE,
          assertedCurrent: true,
          confidence: "HIGH",
          evidenceUrl: rec.sourceUrl,
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
        } satisfies NormalizedFact);
      }
    }

    return facts;
  },
};

export const gleifResolutionRunOptions = { concurrency: 1, maxDocsPerTick: 1 } as const;