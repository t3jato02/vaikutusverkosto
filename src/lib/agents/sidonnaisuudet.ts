// Sidonnaisuudet Adapter — MPs' official declarations of interest.
// Source: Eduskunta open data, member detail `Sidonnaisuudet` block
// (OFFICIAL_PRIMARY). Every declaration is a mandated public disclosure.
//
// The declaration text is free-form Finnish, so extraction is RULE-BASED and
// conservative: only clearly-parseable "board / council member of X" phrases
// become RelationshipCandidates (extractionMethod "rule" → admin review, never
// auto-published). Nothing is inferred beyond what the declaration states.

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import { fetchJsonRetry } from "./http";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const API = "https://avoindata.eduskunta.fi";
const BASE = `${API}/api/v1`;
const PARSER_VERSION = "sidonnaisuudet-rule-1";

interface SeatingRow {
  hetekaId: number;
  lastname: string;
  firstname: string;
}
interface Declaration {
  Otsikko?: string;
  RyhmaOtsikko?: string;
  Sidonta?: string;
}
interface MemberDetail {
  jsonNode?: { Henkilo?: { Sidonnaisuudet?: { Sidonnaisuus?: Declaration[] } } } | string;
}

const NIL = /^ei ilmoitettavia|^ei ole|^-+$|^ei muutoksia/i;

// "<Org> hallituksen jäsen", "<Org>:n hallituksen puheenjohtaja",
// "<Org> kaupunginvaltuuston jäsen", "<Org> johtokunnan varajäsen", ...
const ROLE_RE =
  /^(.*?)[\s,]*(hallituksen puheenjohtaja|hallituksen varapuheenjohtaja|hallituksen jäsen|hallituksen varajäsen|johtokunnan jäsen|johtokunnan puheenjohtaja|valtuuston jäsen|kaupunginvaltuuston jäsen|kunnanvaltuuston jäsen|edustajiston jäsen|neuvottelukunnan jäsen|hallintoneuvoston jäsen)\.?$/i;

function toArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function cleanOrg(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[:.,;]+$/, "")
    .replace(/(?:^|\s)(?:ry|oy|oyj| oyj| ry):?$/i, "")
    .replace(/:n$/i, "")
    .trim();
}

export const sidonnaisuudetAdapter: SourceAdapter = {
  id: "sidonnaisuudet-agent",
  name: "Eduskunta — kansanedustajien sidonnaisuusilmoitukset",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "weekly",
  baseUrl: `${BASE}/memberofparliament/`,
  publisher: "Eduskunta (avoindata.eduskunta.fi)",
  reliabilityTier: "PUBLIC_DISCLOSURE",
  format: "API",
  updateCadence: "weekly",
  termsUrl: "https://avoindata.eduskunta.fi/#/fi/licence",
  notes:
    "Kansanedustajien lakisääteiset sidonnaisuusilmoitukset. Vapaamuotoinen teksti → " +
    "sääntöpohjainen poiminta luo vain SUHDE-EHDOKKAITA (extractionMethod=rule), joita " +
    "ei julkaista automaattisesti. Ei päätellä ilmoitusta laajempaa yhteyttä.",

  async discover(): Promise<SourceDocument[]> {
    const rows = await fetchJsonRetry<SeatingRow[]>(`${BASE}/seating/`);
    return rows
      .filter((r) => r.hetekaId)
      .map((r) => ({
        id: `sidonnaisuus:${r.hetekaId}`,
        url: `${BASE}/memberofparliament/${r.hetekaId}/fi`,
        title: `Sidonnaisuudet — ${r.firstname} ${r.lastname}`,
        hash: "",
        meta: { hetekaId: r.hetekaId, name: `${r.firstname} ${r.lastname}` },
      }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    return fetchJsonRetry<unknown>(doc.url, { maxRetries: 3 });
  },

  async parse(ctx, doc, raw): Promise<NormalizedFact[]> {
    const meta = doc.meta as { hetekaId: number; name: string };
    const detail = raw as MemberDetail;
    const node = (typeof detail.jsonNode === "string" ? JSON.parse(detail.jsonNode) : detail.jsonNode) as
      | { Henkilo?: { Sidonnaisuudet?: { Sidonnaisuus?: Declaration[] } } }
      | undefined;
    const declarations: Declaration[] = toArray(node?.Henkilo?.Sidonnaisuudet?.Sidonnaisuus);
    if (declarations.length === 0) return [];

    const personRef = {
      type: EntityType.PERSON,
      name: meta.name,
      jurisdiction: "FI",
      externalId: { provider: "eduskunta-heteka", identifier: String(meta.hetekaId) },
    };

    const facts: NormalizedFact[] = [];
    for (const d of declarations) {
      const text: string = String(d.Sidonta ?? "").trim();
      if (!text || NIL.test(text)) continue;
      // Split multi-clause declarations on ";" or newline.
      for (const clause of text.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean)) {
        const m = clause.match(ROLE_RE);
        if (!m) continue;
        const org = cleanOrg(m[1]);
        const roleText = m[2].toLowerCase();
        if (org.length < 3) continue;
        const relType = /puheenjohtaja/.test(roleText)
          ? RelationshipType.CHAIRS
          : /hallituk|johtokun|hallintoneuvos/.test(roleText)
            ? RelationshipType.BOARD_MEMBER_OF
            : RelationshipType.MEMBER_OF;
        facts.push({
          kind: "relationship",
          source: personRef,
          target: { type: EntityType.ORGANIZATION, name: org, jurisdiction: "FI" },
          relationshipType: relType,
          role: m[2],
          startDate: null,
          endDate: null,
          confidence: "MEDIUM",
          evidenceUrl: doc.url,
          extractionMethod: "rule",
          extractorVersion: PARSER_VERSION,
        });
        ctx.log(`declared interest: ${meta.name} — ${m[2]} @ ${org}`);
      }
    }
    return facts;
  },
};
