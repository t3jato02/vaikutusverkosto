// Public institutions adapter — state administration, municipal power,
// wellbeing services counties, major NGOs/foundations and labour-market
// organisations.
//
// Deterministic, manifest-driven ingestion (no LLM). The manifest in
// ./data/institutions holds facts transcribed from official public pages;
// every fact carries its own evidence URL. Re-runs are idempotent (collector
// change-detection + upserts). Each section is a bounded document, so a tick
// never processes more than the configured document budget.
//
// Fact kinds produced:
//   - "institutional-category"  → OrganizationInstitutionalCategory
//   - "role"                    → Position (RoleAssignment)
//   - "relationship" (SUPERVISES) → ministry → agency supervision edges
//
// Entity resolution: organisations use a stable `fi-institution` external id
// (or a Y-tunnus for companies) so parallel streams resolve to the SAME
// canonical Entity. Persons resolve by exact canonical name, which reuses
// existing politicians (e.g. MPs) instead of duplicating them.

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import type { AgentFact, EntityRef, InstitutionalCategoryFact, NormalizedFact, RoleAssignmentFact, SourceAdapter, SourceDocument } from "./types";
import { publicInstitutionSections, type ManifestOrg, type ManifestRole } from "./data/institutions";

const PARSER_VERSION = "public-institutions-1";

/** Organisation EntityRef with a deterministic external identity.
 *  - explicit `externalId` wins (cross-stream canonical id, e.g. fi-agency);
 *  - otherwise a Y-tunnus (companies) → deterministic ytj match vs Stream B/PRH;
 *  - otherwise the stream-neutral `fi-institution:<slug>` id. */
function orgRef(org: ManifestOrg): EntityRef {
  const externalId = org.externalId ?? (org.businessId ? undefined : { provider: "fi-institution", identifier: org.id });
  return {
    type: org.type,
    name: org.name,
    subtype: org.subtype ?? null,
    municipality: org.municipality ?? null,
    jurisdiction: "FI",
    countryCode: "FI",
    entityCategory: org.entityCategory,
    description: org.description ?? null,
    alias: org.aliases?.[0] ?? null,
    externalId: externalId ?? null,
    ...(org.businessId ? { businessId: org.businessId } : {}),
  };
}

function personRef(r: ManifestRole): EntityRef {
  return {
    type: EntityType.PERSON,
    name: r.person,
    jurisdiction: "FI",
    ...(r.personExternalId ? { externalId: r.personExternalId } : {}),
  };
}

function appointedByRef(r: ManifestRole, orgBySlug: Map<string, ManifestOrg>): EntityRef | null {
  if (r.appointedBy) {
    const org = orgBySlug.get(r.appointedBy);
    if (org) return orgRef(org);
  }
  if (r.appointedByName) {
    return { type: EntityType.GOVERNMENT_BODY, name: r.appointedByName, jurisdiction: "FI" };
  }
  return null;
}

function date(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const publicInstitutionsAdapter: SourceAdapter = {
  id: "public-institutions-agent",
  name: "Julkisen vallan instituutiot — valtionhallinto, kunnat, hyvinvointialueet, järjestöt",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "weekly",
  baseUrl: "https://valtioneuvosto.fi/",
  publisher: "Valtioneuvosto, virastot, kunnat, hyvinvointialueet ja järjestöt (viralliset sivut)",
  reliabilityTier: "OFFICIAL_PRIMARY",
  format: "HTML",
  updateCadence: "monthly",
  termsUrl: "https://valtioneuvosto.fi/tietoa-sivustosta",
  notes:
    "Kuratoitu, lähdeperustainen manifesti julkisen vallan instituutioista. Jokainen " +
    "rivi viittaa viralliseen julkiseen lähteeseen. Ei LLM-päätelmiä; tosiasiat on " +
    "siirretty ihmisen toimesta virallisilta sivuilta. Henkilöt resoluutoidaan " +
    "tarkalla nimellä (uusiokäyttää olemassa olevat poliitikot), organisaatiot " +
    "pysyvällä fi-institution-tunnisteella tai Y-tunnuksella.",

  async discover(): Promise<SourceDocument[]> {
    return publicInstitutionSections.map((s) => ({
      id: `public-institutions:${s.id}`,
      url: s.url,
      title: s.title,
      hash: "",
      meta: { section: s.id },
    }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    const section = (doc.meta as { section?: string }).section;
    const found = publicInstitutionSections.find((s) => s.id === section);
    return found ?? { orgs: [], roles: [] };
  },

  async parse(ctx, doc, raw): Promise<AgentFact[]> {
    const payload = raw as { orgs?: ManifestOrg[]; roles?: ManifestRole[] };
    const orgs = payload?.orgs ?? [];
    const roles = payload?.roles ?? [];
    if (orgs.length === 0 && roles.length === 0) return [];

    const orgBySlug = new Map(orgs.map((o) => [o.id, o]));
    const facts: AgentFact[] = [];

    // 1. Institutional categories (structural fact about what the org IS).
    for (const org of orgs) {
      facts.push({
        kind: "institutional-category",
        organization: orgRef(org),
        category: org.category,
        confidence: "HIGH",
        evidenceUrl: org.evidenceUrl,
        evidenceTitle: org.sourceName,
        sourceType: SourceType.OFFICIAL_PRIMARY,
        sourceName: org.sourceName,
        publisher: "Julkisten instituutioiden viralliset sivut",
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        evidenceGrade: org.evidenceGrade,
        dedupeKey: `pub-inst-cat:${org.id}:${org.category}`,
      } satisfies InstitutionalCategoryFact);
    }

    // 2. Ministry supervision edges (ministry → agency, "SUPERVISES").
    for (const org of orgs) {
      if (!org.supervisedBy) continue;
      const ministry = orgBySlug.get(org.supervisedBy);
      if (!ministry) {
        ctx.log(`supervisor ${org.supervisedBy} not in manifest (${org.id})`);
        continue;
      }
      facts.push({
        kind: "relationship",
        source: orgRef(ministry),
        target: orgRef(org),
        relationshipType: RelationshipType.SUPERVISES,
        role: "Hallinnonalan ohjaus ja valvonta",
        assertedCurrent: true,
        confidence: "HIGH",
        evidenceUrl: org.evidenceUrl,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
      } satisfies NormalizedFact);
    }

    // 3. Documented person → organisation roles.
    for (const r of roles) {
      const org = orgBySlug.get(r.org);
      if (!org) {
        ctx.log(`role org ${r.org} not in manifest`);
        continue;
      }
      facts.push({
        kind: "role",
        person: personRef(r),
        organization: orgRef(org),
        role: r.role,
        roleType: r.roleType,
        department: r.department ?? null,
        startDate: date(r.startDate),
        endDate: date(r.endDate),
        assertedCurrent: r.current ?? false,
        appointmentMethod: r.appointmentMethod ?? null,
        appointedBy: appointedByRef(r, orgBySlug),
        confidence: r.confidence ?? "HIGH",
        evidenceUrl: r.evidenceUrl,
        evidenceTitle: r.sourceName,
        sourceType: SourceType.OFFICIAL_PRIMARY,
        sourceName: r.sourceName,
        publisher: org.sourceName,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        evidenceGrade: r.evidenceGrade,
        dedupeKey: `pub-inst-role:${r.person}:${r.org}:${r.role}:${r.startDate ?? "?"}:${r.endDate ?? "?"}`,
      } satisfies RoleAssignmentFact);
    }

    ctx.log(`${(doc.meta as { section?: string }).section ?? doc.id}: ${facts.length} facts (${orgs.length} orgs, ${roles.length} roles)`);
    return facts;
  },
};

export const publicInstitutionsRunOptions = { concurrency: 2, maxDocsPerTick: 3 } as const;