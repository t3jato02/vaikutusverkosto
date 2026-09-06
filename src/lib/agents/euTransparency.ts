// EU Transparency Register adapter.
// Source: official live XML export
//   https://transparency-register.europa.eu/odplastorganisationxml_en
// (OFFICIAL_REGISTER). A rolling snapshot of recently registered/updated
// interest representatives.
//
// Scope: organisations with a Finnish head office. Each becomes:
//   org --REGISTERED_LOBBY_ORGANIZATION--> "EU:n avoimuusrekisteri"
//     (deterministic, structured field -> SOURCE_CONFIRMED)
//   org --REPRESENTS_INTERESTS_OF--> <client>   (free-text client name ->
//     RelationshipCandidate, never auto-published)
// Nothing is inferred beyond the register entry. Never "INFLUENCES".

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const XML_URL = "https://transparency-register.europa.eu/odplastorganisationxml_en";
const PARSER_VERSION = "eu-tr-1";

const REGISTER_REF = {
  type: EntityType.GOVERNMENT_BODY,
  name: "EU:n avoimuusrekisteri",
  subtype: "EU:n rekisteri",
  jurisdiction: "EU",
  countryCode: "EU",
  entityCategory: "INTERNATIONAL_ORGANIZATION" as const,
  description:
    "Euroopan parlamentin ja komission yhteinen avoimuusrekisteri (Transparency Register) — " +
    "EU-tason edunvalvontaa harjoittavat organisaatiot.",
  externalId: { provider: "eu-tr", identifier: "transparency-register" },
} as const;

interface TrOrg {
  code: string;
  name: string;
  acronym: string | null;
  entityForm: string | null;
  category: string | null;
  registrationDate: string | null;
  city: string | null;
  interests: string[];
  clients: string[];
  levels: string[];
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) : null;
}
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOrg(block: string): TrOrg | null {
  const code = tag(block, "identificationCode");
  const nameBlock = block.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? "";
  const name = tag(nameBlock, "originalName") ?? tag(nameBlock, "nameInLatinAlphabet");
  if (!code || !name) return null;
  const head = block.match(/<headOffice>([\s\S]*?)<\/headOffice>/)?.[1] ?? "";
  const interests = [...(block.match(/<interests>([\s\S]*?)<\/interests>/)?.[1] ?? "").matchAll(/<name>([^<]+)<\/name>/g)].map((m) => decodeXml(m[1]));
  const clients = [...(block.match(/<clients>([\s\S]*?)<\/clients>/)?.[1] ?? "").matchAll(/<client>\s*<name>([^<]+)<\/name>/g)].map((m) => decodeXml(m[1]));
  const levels = [...(block.match(/<levelsOfInterest>([\s\S]*?)<\/levelsOfInterest>/)?.[1] ?? "").matchAll(/<levelOfInterest>([a-z]+)<\/levelOfInterest>/g)].map((m) => m[1]);
  return {
    code,
    name,
    acronym: tag(block, "acronym"),
    entityForm: tag(block, "entityForm"),
    category: tag(block, "registrationCategory"),
    registrationDate: tag(block, "registrationDate"),
    city: tag(head, "city"),
    interests,
    clients,
    levels,
  };
}

function categoryOf(cat: string | null):
  | "COMPANY" | "NGO" | "THINK_TANK" | "UNIVERSITY" | "OTHER" {
  const c = (cat ?? "").toLowerCase();
  if (/think tank|research institution/.test(c)) return "THINK_TANK";
  if (/non-governmental|ngo|platform|network/.test(c)) return "NGO";
  if (/academic|universit/.test(c)) return "UNIVERSITY";
  if (/compan|business|consultanc|trade/.test(c)) return "COMPANY";
  return "OTHER";
}

async function fetchFinnishOrgs(): Promise<TrOrg[]> {
  const res = await fetch(XML_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`EU TR: HTTP ${res.status}`);
  const xml = await res.text();
  const blocks = xml.split("<interestRepresentative>").slice(1).map((b) => b.split("</interestRepresentative>")[0]);
  const out: TrOrg[] = [];
  for (const b of blocks) {
    if (!/<headOffice>[\s\S]*?<country>FINLAND<\/country>/.test(b)) continue;
    const org = parseOrg(b);
    if (org) out.push(org);
  }
  return out;
}

export const euTransparencyAdapter: SourceAdapter = {
  id: "eu-transparency-register",
  name: "EU:n avoimuusrekisteri — suomalaiset edunvalvontaorganisaatiot",
  sourceType: SourceType.OFFICIAL_REGISTER,
  schedule: "weekly",
  baseUrl: "https://transparency-register.europa.eu/",
  publisher: "Euroopan parlamentti / Euroopan komissio",
  reliabilityTier: "OFFICIAL_REGISTER",
  format: "API",
  updateCadence: "weekly",
  termsUrl: "https://transparency-register.europa.eu/about-register/legal-notice_en",
  notes:
    "Avoimuusrekisterin virallinen XML-vienti (odplastorganisationxml). Vain suomalaiset " +
    "pääkonttorit. Rekisteröinti → SOURCE_CONFIRMED; asiakkaat (vapaamuotoinen nimi) → " +
    "SUHDE-EHDOKKAITA. Ei koskaan INFLUENCES.",

  async discover(ctx): Promise<SourceDocument[]> {
    const orgs = await fetchFinnishOrgs();
    ctx.log(`EU TR: ${orgs.length} Finnish-HQ organisations`);
    return orgs.map((o) => ({
      id: `eu-tr:${o.code}`,
      url: `${XML_URL}#${encodeURIComponent(o.code)}`,
      title: `EU:n avoimuusrekisteri — ${o.name}`,
      publishedAt: o.registrationDate ? new Date(o.registrationDate) : null,
      hash: "",
      meta: o,
    }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    return doc.meta;
  },

  async parse(ctx, doc, raw): Promise<NormalizedFact[]> {
    const o = raw as TrOrg;
    if (!o?.code || !o.name) return [];
    const orgRef = {
      type: EntityType.ORGANIZATION as EntityType,
      name: o.name,
      jurisdiction: "FI",
      countryCode: "FI",
      entityCategory: categoryOf(o.category),
      municipality: o.city,
      subtype: o.entityForm ?? undefined,
      externalId: { provider: "eu-tr", identifier: o.code },
      alias: o.acronym ?? undefined,
    };
    const facts: NormalizedFact[] = [];

    // 1. Registration — deterministic, structured official field.
    facts.push({
      kind: "relationship",
      source: orgRef,
      target: { ...REGISTER_REF },
      relationshipType: RelationshipType.REGISTERED_LOBBY_ORGANIZATION,
      role: [o.category, o.interests.length ? `intressit: ${o.interests.join(", ")}` : null, o.levels.length ? `taso: ${o.levels.join("/")}` : null]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 400) || null,
      startDate: o.registrationDate ? new Date(o.registrationDate) : null,
      endDate: null,
      assertedCurrent: true,
      confidence: "VERIFIED",
      evidenceUrl: XML_URL,
      extractionMethod: "deterministic-parser",
      extractorVersion: PARSER_VERSION,
    });

    // 2. Clients — free-text name → candidate lane, never auto-published.
    for (const client of o.clients.slice(0, 25)) {
      if (client.length < 3) continue;
      facts.push({
        kind: "relationship",
        source: orgRef,
        target: { type: EntityType.ORGANIZATION, name: client, jurisdiction: "EU" },
        relationshipType: RelationshipType.REPRESENTS_INTERESTS_OF,
        role: "avoimuusrekisterin ilmoittama asiakas",
        startDate: null,
        endDate: null,
        confidence: "MEDIUM",
        evidenceUrl: XML_URL,
        extractionMethod: "rule",
        extractorVersion: PARSER_VERSION,
      });
    }
    ctx.log(`EU TR: ${o.name} — registration + ${o.clients.length} client(s)`);
    return facts;
  },
};
