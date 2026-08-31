// Eduskunta Adapter — official Finnish Parliament open-data API.
// Source: https://avoindata.eduskunta.fi/api/v1/ (OFFICIAL_PRIMARY).

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import { fetchJsonLatin1Retry } from "./http";
import type { NormalizedFact, SourceAdapter } from "./types";

const API = "https://avoindata.eduskunta.fi";
const BASE = `${API}/api/v1`;

const PARTY_CODES: Record<string, string> = {
  kok: "Kansallinen Kokoomus",
  sd: "Suomen Sosialidemokraattinen Puolue",
  ps: "Perussuomalaiset",
  kesk: "Suomen Keskusta",
  vas: "Vasemmistoliitto",
  vihr: "Vihreä liitto",
  r: "Svenska folkpartiet i Finland",
  kd: "Suomen Kristillisdemokraatit",
  liik: "Liike Nyt",
};

interface SeatingRow {
  hetekaId: number;
  seatNumber: number;
  lastname: string;
  firstname: string;
  party: string;
  minister: boolean;
  pictureUrl: string;
}

interface CommitteeMembership {
  Nimi: string;
  Tunnus?: string;
  OnkoValiokunta?: boolean;
  Jasenyys?: { Rooli?: string; AlkuPvm?: string; LoppuPvm?: string }[];
}

interface MemberDetail {
  jsonNode?: {
    Henkilo?: {
      SukuNimi?: string;
      KutsumaNimi?: string;
      SyntymaPvm?: string;
      Ammatti?: string;
      NykyinenKotikunta?: string;
      Eduskuntaryhmat?: { NykyinenEduskuntaryhma?: { AlkuPvm?: string } };
      NykyisetToimielinjasenyydet?: { Toimielin?: CommitteeMembership[] };
      AiemmatToimielinjasenyydet?: { Toimielin?: CommitteeMembership[] };
      Edustajatoimet?: { Edustajatoimi?: { AlkuPvm?: string; LoppuPvm?: string }[] };
      Vaalipiirit?: { NykyinenVaalipiiri?: { Nimi?: string } };
    };
  };
}

function parseDate(ddmmyyyy?: string | null): Date | null {
  if (!ddmmyyyy || !/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) return null;
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function committeeKey(name: string): string {
  // Must match the historical slug function exactly to keep identifiers stable.
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9äöå]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `name:${slug}`;
}

export const eduskuntaAdapter: SourceAdapter = {
  id: "parliament-agent",
  name: "Eduskunta — kansanedustajat, puolueet ja valiokunnat",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "daily",
  baseUrl: `${BASE}/seating/`,
  publisher: "Eduskunta (avoindata.eduskunta.fi)",

  async discover(ctx) {
    const seating = await fetchJsonLatin1Retry<SeatingRow[]>(`${BASE}/seating/`);
    ctx.log(`seating list: ${seating.length} members`);
    return seating.map((row) => ({
      id: String(row.hetekaId),
      url: `${BASE}/memberofparliament/${row.hetekaId}/fi`,
      title: `Kansanedustaja: ${row.firstname} ${row.lastname}`,
      hash: `member-${row.hetekaId}`,
      meta: row,
    }));
  },

  async fetch(_ctx, doc) {
    return fetchJsonLatin1Retry<unknown>(doc.url, { maxRetries: 3 });
  },

  async parse(_ctx, doc, raw) {
    const detail = raw as MemberDetail;
    const h = detail.jsonNode?.Henkilo ?? {};
    const hetekaId = Number(doc.id);
    const row = (doc.meta as SeatingRow) ?? { lastname: h.SukuNimi ?? "", firstname: h.KutsumaNimi ?? "", party: "", minister: false, pictureUrl: "" };
    const canonicalName = `${h.KutsumaNimi ?? row.firstname} ${h.SukuNimi ?? row.lastname}`.trim();
    const partyCode = row.party;
    const partyName = PARTY_CODES[partyCode];

    const facts: NormalizedFact[] = [];

    // Person entity reference (strong external ID = hetekaId).
    const personRef = {
      type: EntityType.PERSON,
      name: canonicalName,
      jurisdiction: "FI",
      externalId: { provider: "eduskunta-heteka", identifier: String(hetekaId) },
      municipality: h.NykyinenKotikunta ?? null,
      description: h.Ammatti ? `Ammatti: ${h.Ammatti}` : null,
    };
    const personProfile = {
      hetekaId,
      firstName: row.firstname,
      lastName: row.lastname,
      birthYear: parseDate(h.SyntymaPvm)?.getFullYear() ?? null,
      imageUrl: row.pictureUrl ? `${API}/${row.pictureUrl}` : null,
      electoralDistrict: h.Vaalipiirit?.NykyinenVaalipiiri?.Nimi ?? null,
      municipality: h.NykyinenKotikunta ?? null,
      profession: h.Ammatti ?? null,
    };

    // Party membership
    if (partyName) {
      facts.push({
        kind: "relationship",
        source: personRef,
        target: {
          type: EntityType.POLITICAL_PARTY,
          name: partyName,
          jurisdiction: "FI",
          externalId: { provider: "eduskunta-party", identifier: partyCode },
        },
        relationshipType: RelationshipType.MEMBER_OF,
        role: "Kansanedustaja",
        startDate: parseDate(h.Eduskuntaryhmat?.NykyinenEduskuntaryhma?.AlkuPvm) ?? null,
        confidence: "VERIFIED",
        evidenceUrl: doc.url,
        sourceProfile: personProfile,
      });
    }

    // Parliament membership (MP position)
    const terms = toArray(h.Edustajatoimet?.Edustajatoimi);
    const currentTerm = terms.find((t: { LoppuPvm?: string }) => !t.LoppuPvm);
    const start = parseDate(currentTerm?.AlkuPvm) ?? parseDate(terms[0]?.AlkuPvm);
    const end = parseDate(currentTerm?.LoppuPvm);
    facts.push({
      kind: "relationship",
      source: personRef,
      target: {
        type: EntityType.GOVERNMENT_BODY,
        name: "Eduskunta",
        jurisdiction: "FI",
        externalId: { provider: "eduskunta", identifier: "parliament" },
      },
      relationshipType: RelationshipType.MEMBER_OF,
      role: "Kansanedustaja",
      startDate: start,
      endDate: end,
      confidence: "VERIFIED",
      evidenceUrl: doc.url,
      sourceProfile: personProfile,
    });

    // Committee memberships (current + former)
    const committees: CommitteeMembership[] = [
      ...toArray(h.NykyisetToimielinjasenyydet?.Toimielin),
      ...toArray(h.AiemmatToimielinjasenyydet?.Toimielin),
    ];
    for (const c of committees) {
      if (!c.Nimi) continue;
      for (const m of toArray(c.Jasenyys)) {
        facts.push({
          kind: "relationship",
          source: personRef,
          target: {
            type: EntityType.ORGANIZATION,
            name: c.Nimi,
            jurisdiction: "FI",
            subtype: "parliament_committee",
            externalId: { provider: "eduskunta-committee", identifier: committeeKey(c.Nimi) },
          },
          relationshipType: RelationshipType.MEMBER_OF,
          role: m.Rooli ?? "Jäsen",
          startDate: parseDate(m.AlkuPvm),
          endDate: parseDate(m.LoppuPvm),
          confidence: "VERIFIED",
          evidenceUrl: doc.url,
          sourceProfile: personProfile,
        });
      }
    }

    return facts;
  },

  async onFactPublished(ctx, fact, entityIds) {
    if (!entityIds.source) return;
    const profile = fact.sourceProfile as Record<string, unknown> | undefined;
    if (!profile) return;

    const data: Record<string, unknown> = {};
    if (profile.firstName) data.firstName = profile.firstName as string;
    if (profile.lastName) data.lastName = profile.lastName as string;
    if (typeof profile.hetekaId === "number") data.hetekaId = profile.hetekaId;
    if (typeof profile.birthYear === "number") data.birthYear = profile.birthYear;
    if (profile.imageUrl) data.imageUrl = profile.imageUrl as string;
    if (profile.electoralDistrict) data.electoralDistrict = profile.electoralDistrict as string;
    if (profile.profession) data.profession = profile.profession as string;

    // Party pointer
    if (fact.target.type === EntityType.POLITICAL_PARTY && entityIds.target) {
      data.partyEntityId = entityIds.target;
    }

    if (Object.keys(data).length > 0) {
      await ctx.db.person.upsert({
        where: { entityId: entityIds.source },
        update: data,
        create: { entityId: entityIds.source, ...data },
      });
    }

    // Position row for MP seat in parliament
    if (fact.relationshipType === RelationshipType.MEMBER_OF && fact.target.name === "Eduskunta") {
      const existing = await ctx.db.position.findFirst({
        where: { personEntityId: entityIds.source, organizationEntityId: entityIds.target ?? undefined, role: "Kansanedustaja" },
      });
      const isCurrent = !fact.endDate;
      if (existing) {
        await ctx.db.position.update({
          where: { id: existing.id },
          data: { startDate: fact.startDate, endDate: fact.endDate, isCurrent, sourceId: ctx.sourceId, updatedAt: new Date() },
        });
      } else {
        await ctx.db.position.create({
          data: {
            personEntityId: entityIds.source,
            organizationEntityId: entityIds.target ?? undefined,
            role: "Kansanedustaja",
            startDate: fact.startDate,
            endDate: fact.endDate,
            isCurrent,
            sourceId: ctx.sourceId,
          },
        });
      }
    }
  },
};