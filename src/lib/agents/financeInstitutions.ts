// FinanceInstitutionAgent — the people and organisations controlling
// substantial financial resources or important financial-market infrastructure:
// banks, credit institutions, insurers, asset managers, fund managers,
// payment/exchange infrastructure and public investment organisations.
//
// Deterministic, manifest-driven ingestion (no LLM). The manifest in
// ./data/finance holds facts transcribed from official public pages; every
// fact carries its own evidence URL. Re-runs are idempotent (collector
// change-detection + upserts). Each section is a bounded document.
//
// Fact kinds produced:
//   - "finance-institution" → FinanceInstitutionProfile (+ LEI/BIC aliases)
//   - "sector"              → OrganizationSector
//   - "role"                → Position (RoleAssignment)
//   - "scale-statement"     → InstitutionScaleStatement (year + source)
//   - "external-identifier" → nasdaq-issuer marker for listed issuers
//   - "relationship"        → FIN-FSA SUPERVISES edges and PART_OF parents
//
// Entity resolution: organisations use a stable `fi-finance` external id (or a
// Y-tunnus for companies) so parallel streams resolve to the SAME canonical
// Entity. Persons resolve by exact canonical name, reusing existing people.

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import type { AgentFact, EntityRef, ExternalIdentifierFact, FinanceInstitutionFact, NormalizedFact, OrganizationSectorFact, RoleAssignmentFact, ScaleStatementFact, SourceAdapter, SourceDocument } from "./types";
import { financeSections, type ManifestOrg, type ManifestRole } from "./data/finance";

const PARSER_VERSION = "finance-institutions-1";

/** Organisation EntityRef with a deterministic external identity. */
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

export const financeInstitutionsAdapter: SourceAdapter = {
  id: "finance-institutions-agent",
  name: "Finanssilaitokset — pankit, vakuutusyhtiöt, varainhoitajat, maksu- ja pörssi-infrastruktuuri",
  sourceType: SourceType.OFFICIAL_PRIMARY,
  schedule: "weekly",
  baseUrl: "https://www.finanssivalvonta.fi/rekisterit/",
  publisher: "Finanssivalvonta, yhtiöiden viralliset sivut ja vuosikertomukset",
  reliabilityTier: "OFFICIAL_PRIMARY",
  format: "HTML",
  updateCadence: "monthly",
  termsUrl: "https://www.finanssivalvonta.fi/",
  notes:
    "Kuratoitu, lähdeperustainen manifesti merkittävimmistä Suomessa toimivista " +
    "finanssilaitoksista ja rahoitusmarkkinainfrastruktuurista. Jokainen rivi " +
    "viittaa viralliseen julkiseen lähteeseen (yhtiön hallintosivut, FIN-FSA, " +
    "GLEIF). Ei LLM-päätelmiä; tosiasiat on siirretty ihmisen toimesta " +
    "virallisilta sivuilta. Pörssiyhtiöt merkitään nasdaq-issuer-tunnisteella " +
    "hallituskytkösanalyysejä varten. Valtion sijoitusomaisuutta ei koskaan " +
    "lasketa henkilökohtaiseksi varallisuudeksi.",

  async discover(): Promise<SourceDocument[]> {
    return financeSections.map((s) => ({
      id: `finance:${s.id}`,
      url: s.url,
      title: s.title,
      hash: "",
      meta: { section: s.id },
    }));
  },

  async fetch(_ctx, doc): Promise<unknown> {
    const section = (doc.meta as { section?: string }).section;
    const found = financeSections.find((s) => s.id === section);
    return found ?? { orgs: [], roles: [] };
  },

  async parse(ctx, doc, raw): Promise<AgentFact[]> {
    const payload = raw as { orgs?: ManifestOrg[]; roles?: ManifestRole[] };
    const orgs = payload?.orgs ?? [];
    const roles = payload?.roles ?? [];
    if (orgs.length === 0 && roles.length === 0) return [];

    const orgBySlug = new Map(orgs.map((o) => [o.id, o]));
    const facts: AgentFact[] = [];

    const finFsa = orgs.find((o) => o.id === "finanssivalvonta");
    const finFsaRef = finFsa ? orgRef(finFsa) : null;

    // 1. Finance-institution profile + sectors + scale statements + listed-issuer marker.
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
          publisher: "Rahoituslaitosten viralliset sivut ja rekisterit",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: org.evidenceGrade,
          dedupeKey: `finance-profile:${org.id}:${t}`,
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
          publisher: "Rahoituslaitosten viralliset sivut",
          extractionMethod: "deterministic-parser",
          evidenceGrade: org.evidenceGrade,
          dedupeKey: `finance-sector:${org.id}:${sector}`,
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
          publisher: "Laitoksen oma tilinpäätös-/tulostieto",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: s.evidenceGrade,
          dedupeKey: `finance-scale:${org.id}:${s.metric}:${s.year}`,
        } satisfies ScaleStatementFact);
      }

      if (org.nasdaqSymbol) {
        facts.push({
          kind: "external-identifier",
          entity: ref,
          provider: "nasdaq-issuer",
          identifier: org.nasdaqSymbol,
          confidence: "HIGH",
          evidenceUrl: "https://www.nasdaq.com/products/european-markets/helsinki",
          evidenceTitle: "Nasdaq Helsinki",
          sourceType: SourceType.OFFICIAL_REGISTER,
          sourceName: "Nasdaq Helsinki (nasdaq.com)",
          publisher: "Nasdaq",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
          evidenceGrade: "A",
          dedupeKey: `nasdaq-issuer:${org.nasdaqSymbol}`,
        } satisfies ExternalIdentifierFact);
      }
    }

    // 2. Supervision edges (FIN-FSA SUPERVISES the institution) — only when
    //    FIN-FSA itself is part of the same manifest section set.
    if (finFsaRef) {
      for (const org of orgs) {
        if (!org.supervisedByFinFsa) continue;
        facts.push({
          kind: "relationship",
          source: finFsaRef,
          target: orgRef(org),
          relationshipType: RelationshipType.SUPERVISES,
          role: "Finanssivalvonnan valvonta (toimilupa- ja vakavaraisuusvalvonta)",
          assertedCurrent: true,
          confidence: "HIGH",
          evidenceUrl: "https://www.finanssivalvonta.fi/finanssivalvonta/tehtavat/",
          extractionMethod: "deterministic-parser",
          extractorVersion: PARSER_VERSION,
        } satisfies NormalizedFact);
      }
    }

    // 3. Documented parent organisations (GLEIF-verified where available).
    for (const org of orgs) {
      if (!org.parent) continue;
      const parent = org.parent;
      const parentRef: EntityRef = {
        type: parent.type ?? EntityType.COMPANY,
        name: parent.name,
        jurisdiction: parent.countryCode ?? "FI",
        countryCode: parent.countryCode ?? "FI",
        externalId: parent.lei
          ? { provider: "gleif-lei", identifier: parent.lei }
          : undefined,
      };
      facts.push({
        kind: "relationship",
        source: orgRef(org),
        target: parentRef,
        relationshipType: RelationshipType.PART_OF,
        role: "Konsernin emoyhtiö (dokumentoitu konsernisuhde)",
        assertedCurrent: true,
        confidence: "HIGH",
        evidenceUrl: parent.sourceUrl,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
      } satisfies NormalizedFact);
    }

    // 4. Documented person → organisation roles.
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
        dedupeKey: `finance-role:${r.person}:${r.org}:${r.role}:${r.startDate ?? "?"}`,
      } satisfies RoleAssignmentFact);
    }

    ctx.log(`${(doc.meta as { section?: string }).section ?? doc.id}: ${facts.length} facts (${orgs.length} orgs, ${roles.length} roles)`);
    return facts;
  },
};

export const financeInstitutionsRunOptions = { concurrency: 2, maxDocsPerTick: 6 } as const;