// PensionGovernanceAgent — governance of the institutions managing Finnish
// earnings-related pension assets: the pension insurers (Ilmarinen, Varma,
// Elo, Veritas) and the public pension institutions (Keva, Valtion
// Eläkerahasto, Eläketurvakeskus).
//
// Deterministic, manifest-driven ingestion (no LLM). Every fact carries its own
// evidence URL; re-runs are idempotent. Investment leadership (CIO /
// sijoitusjohtaja) is documented where the institution's own pages state it —
// the role is a documented fact, never an inference.
//
// Fact kinds produced: "finance-institution", "sector", "role", "scale-statement".

import { EntityType, SourceType } from "@prisma/client";
import type { AgentFact, EntityRef, FinanceInstitutionFact, OrganizationSectorFact, RoleAssignmentFact, ScaleStatementFact, SourceAdapter, SourceDocument } from "./types";
import { pensionSections, type ManifestOrg, type ManifestRole } from "./data/finance";

const PARSER_VERSION = "pension-governance-1";

function orgRef(org: ManifestOrg): EntityRef {
  const externalId = org.externalId ?? (org.businessId ? undefined : { provider: "fi-finance", identifier: org.id });
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

function date(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const pensionGovernanceAdapter: SourceAdapter = {
  id: "pension-governance-agent",
  name: "Eläkevarojen hallinto — työeläkevakuuttajat ja julkiset eläkelaitokset",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "weekly",
  baseUrl: "https://www.etk.fi/",
  publisher: "Työeläkevakuutusyhtiöiden ja julkisten eläkelaitosten viralliset sivut",
  reliabilityTier: "OFFICIAL_PRIMARY",
  format: "HTML",
  updateCadence: "monthly",
  termsUrl: "https://www.etk.fi/tietoa-etksta/",
  notes:
    "Kuratoitu, lähdeperustainen manifesti eläkevarallisuutta hallinnoivien " +
    "laitosten hallinnosta. Jokainen rivi viittaa viralliseen julkiseen " +
    "lähteeseen. Sijoitustoiminnan johto mukaan vain, kun lähde dokumentoi " +
    "tehtävän. Eläkevarallisuuslukuja ei koskaan lasketa henkilökohtaiseksi " +
    "varallisuudeksi; ne tallennetaan vuosi + lähde -periaatteella.",

  async discover(): Promise<SourceDocument[]> {
    return pensionSections.map((s) => ({
      id: `pension:${s.id}`,
      url: s.url,
      title: s.title,
      hash: "",
      meta: { section: s.id },
    }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    const section = (doc.meta as { section?: string }).section;
    const found = pensionSections.find((s) => s.id === section);
    return found ?? { orgs: [], roles: [] };
  },

  async parse(ctx, doc, raw): Promise<AgentFact[]> {
    const payload = raw as { orgs?: ManifestOrg[]; roles?: ManifestRole[] };
    const orgs = payload?.orgs ?? [];
    const roles = payload?.roles ?? [];
    if (orgs.length === 0 && roles.length === 0) return [];

    const facts: AgentFact[] = [];

    for (const org of orgs) {
      const ref = orgRef(org);
      for (const t of org.financeTypes) {
        facts.push({
          kind: "finance-institution",
          organization: ref,
          institutionType: t,
          finFsaRegistrationId: org.finFsaRegistrationId ?? null,
          lei: org.lei ?? null,
          bic: org.bic ?? null,
          officialUrl: org.officialUrl ?? null,
          aliases: org.aliases ?? null,
          confidence: "HIGH",
          evidenceUrl: org.evidenceUrl,
          evidenceTitle: org.sourceName,
          sourceType: SourceType.OFFICIAL_PRIMARY,
          sourceName: org.sourceName,
          publisher: "Eläkelaitosten viralliset sivut",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: org.evidenceGrade,
          dedupeKey: `pension-profile:${org.id}:${t}`,
        } satisfies FinanceInstitutionFact);
      }

      for (const sector of org.sectors) {
        facts.push({
          kind: "sector",
          organization: ref,
          sector,
          confidence: "HIGH",
          evidenceUrl: org.evidenceUrl,
          evidenceTitle: org.sourceName,
          sourceType: SourceType.OFFICIAL_PRIMARY,
          sourceName: org.sourceName,
          publisher: "Eläkelaitosten viralliset sivut",
          extractionMethod: "deterministic-parser",
          evidenceGrade: org.evidenceGrade,
          dedupeKey: `pension-sector:${org.id}:${sector}`,
        } satisfies OrganizationSectorFact);
      }

      for (const s of org.scaleStatements ?? []) {
        facts.push({
          kind: "scale-statement",
          entity: ref,
          metricType: s.metric,
          value: s.value,
          currency: s.currency,
          year: s.year,
          note: s.note ?? null,
          confidence: "HIGH",
          evidenceUrl: s.sourceUrl,
          evidenceTitle: s.sourceName,
          sourceType: SourceType.ANNUAL_REPORT,
          sourceName: s.sourceName,
          publisher: "Laitoksen oma tulostieto",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: s.evidenceGrade,
          dedupeKey: `pension-scale:${org.id}:${s.metric}:${s.year}`,
        } satisfies ScaleStatementFact);
      }
    }

    const orgBySlug = new Map(orgs.map((o) => [o.id, o]));
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
        confidence: r.confidence ?? "HIGH",
        evidenceUrl: r.evidenceUrl,
        evidenceTitle: r.sourceName,
        sourceType: SourceType.OFFICIAL_PRIMARY,
        sourceName: r.sourceName,
        publisher: org.sourceName,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        evidenceGrade: r.evidenceGrade,
        dedupeKey: `pension-role:${r.person}:${r.org}:${r.role}:${r.startDate ?? "?"}`,
      } satisfies RoleAssignmentFact);
    }

    ctx.log(`${(doc.meta as { section?: string }).section ?? doc.id}: ${facts.length} facts (${orgs.length} orgs, ${roles.length} roles)`);
    return facts;
  },
};

export const pensionGovernanceRunOptions = { concurrency: 2, maxDocsPerTick: 2 } as const;