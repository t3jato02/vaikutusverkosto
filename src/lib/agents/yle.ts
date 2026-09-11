// Yleisradio Oy adapter — official public-media finance & governance data.
//
// Deterministic, manifest-driven ingestion (no LLM). The manifest in
// ./data/yle holds figures transcribed from Yle's official finances / annual
// report pages and documented leadership records; every fact carries its own
// evidence URL. Re-runs are idempotent (collector change-detection + upserts).
//
// Source typing per fact:
//   - yle.fi official pages        → ORGANIZATION_DISCLOSURE (auto-publish)
//   - Wikipedia leadership history → REPUTABLE_MEDIA → review queue
// The review queue lets an admin accept documented-but-secondary facts.

import { EntityType, RelationshipType, SourceType } from "@prisma/client";
import type { AgentFact, EntityRef, NormalizedFact, SourceAdapter } from "./types";
import {
  yleProfile,
  yleOwnership,
  yleCeos,
  yleBoard,
  yleManagement,
  yleGovernance,
  yleFinances,
} from "./data/yle";

const YLE_REF: EntityRef = {
  type: EntityType.MEDIA_ORGANIZATION,
  name: yleProfile.canonicalName,
  subtype: yleProfile.subtype,
  externalId: { provider: "fi-media", identifier: "yleisradio-oy" },
  alias: "Yle",
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "MEDIA_ORGANIZATION",
};

const STATE_REF: EntityRef = {
  type: EntityType.GOVERNMENT_BODY,
  name: "Suomen valtio",
  externalId: { provider: "vnk", identifier: "suomen-valtio" },
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "GOVERNMENT",
};

const TRAFICOM_REF: EntityRef = {
  type: EntityType.PUBLIC_AUTHORITY,
  name: "Liikenne- ja viestintävirasto Traficom",
  externalId: { provider: "fi-agency", identifier: "traficom" },
  jurisdiction: "FI",
  countryCode: "FI",
  entityCategory: "GOVERNMENT_AGENCY",
};

const COUNCIL_REF: EntityRef = {
  type: EntityType.ORGANIZATION,
  name: yleGovernance.councilName,
  jurisdiction: "FI",
  subtype: "parliament_committee",
};

function personRef(name: string) {
  return { type: EntityType.PERSON, name, jurisdiction: "FI" };
}

function startOfYear(year: number | null): Date | null {
  return year ? new Date(Date.UTC(year, 0, 1)) : null;
}

export const yleAdapter: SourceAdapter = {
  id: "yle-agent",
  name: "Yleisradio Oy — rahoitus, johto ja hallinto",
  sourceType: SourceType.ORGANIZATION_DISCLOSURE,
  schedule: "weekly",
  baseUrl: "https://yle.fi/a/20-10009579",
  publisher: "Yleisradio Oy (yle.fi)",
  reliabilityTier: "ANNUAL_REPORT",
  format: "HTML",
  updateCadence: "weekly",
  termsUrl: "https://yle.fi/aihe/about-yle/contact-us",
  notes:
    "Ylen viralliset rahoitus-, tilinpäätös-, hallinto- ja johtotiedot. " +
    "Manifestipohjainen, lähdeperustainen deterministinen ingestio; jokainen " +
    "rivi viittaa julkiseen lähteeseen. Historialliset toimitusjohtajat " +
    "Wikipedia-lähteestä menevät tarkistusjonoon.",

  async discover(ctx) {
    const docs = [
      { id: "yle-profile", url: yleProfile.officialUrl, title: "This is Yle — Yleisradio Oy (yle.fi)", hash: "profile-v1", meta: { section: "profile" } },
      { id: "yle-leadership", url: "https://yle.fi/aihe/about-yle/yles-ceo-and-the-management-group", title: "Yle's CEO and Management Group + Board (yle.fi)", hash: "leadership-v1", meta: { section: "leadership" } },
      { id: "yle-governance", url: "https://yle.fi/aihe/about-yle/yles-administrative-council", title: "Yle's Administrative Council (yle.fi)", hash: "governance-v1", meta: { section: "governance" } },
      ...yleFinances.map((f) => ({
        id: f.docId,
        url: f.url,
        title: f.title,
        hash: `finances-${f.docId}-v1`,
        meta: { section: "finances", docId: f.docId },
      })),
    ];
    ctx.log(`yle manifest: ${docs.length} documents`);
    return docs;
  },

  async fetch(_ctx, doc) {
    // Deterministic manifest payload; the collector hashes it for change
    // detection, so re-runs are no-ops until the manifest changes.
    const meta = doc.meta as { section?: string; docId?: string } | undefined;
    switch (meta?.section) {
      case "profile":
        return { json: { profile: yleProfile, ownership: yleOwnership } };
      case "leadership":
        return { json: { ceos: yleCeos, board: yleBoard, management: yleManagement } };
      case "governance":
        return { json: { governance: yleGovernance } };
      case "finances":
        return { json: yleFinances.find((f) => f.docId === meta?.docId) };
      default:
        return { json: {} };
    }
  },

  async parse(ctx, doc, raw) {
    const facts: AgentFact[] = [];
    const section = (doc.meta as { section?: string } | undefined)?.section;
    const data = (raw as { json?: unknown }).json;

    if (section === "profile") {
      const ownership = (data as { ownership?: typeof yleOwnership }).ownership ?? [];
      for (const o of ownership) {
        facts.push({
          kind: "relationship",
          source: {
            type: EntityType.GOVERNMENT_BODY,
            name: o.ownerName,
            externalId: o.ownerExternalId,
            jurisdiction: "FI",
            countryCode: "FI",
            entityCategory: "GOVERNMENT",
          },
          target: YLE_REF,
          relationshipType: RelationshipType.OWNS,
          role: "Valtion omistus (Liikenne- ja viestintäministeriön hallinnonala)",
          ownershipPercent: o.percent ?? undefined,
          assertedCurrent: true,
          confidence: "VERIFIED",
          evidenceUrl: o.url,
          sourceProfile: { yleProfile: true },
        } satisfies NormalizedFact);
      }
      // Traficom supervises the legality of Yle's operations (official page).
      facts.push({
        kind: "relationship",
        source: TRAFICOM_REF,
        target: YLE_REF,
        relationshipType: RelationshipType.SUPERVISES,
        role: "Toiminnan lainmukaisuuden valvonta",
        assertedCurrent: true,
        confidence: "VERIFIED",
        evidenceUrl: yleProfile.officialUrl,
        sourceProfile: { yleProfile: true },
      } satisfies NormalizedFact);
    }

    if (section === "leadership") {
      const { ceos, board, management } = data as { ceos: typeof yleCeos; board: typeof yleBoard; management: typeof yleManagement };
      for (const p of [...ceos, ...board, ...management]) {
        facts.push({
          kind: "relationship",
          source: personRef(p.name),
          target: YLE_REF,
          relationshipType: p.relationshipType,
          role: p.role,
          startDate: startOfYear(p.since),
          endDate: startOfYear(p.until),
          assertedCurrent: p.current,
          confidence: p.grade === "A" ? "VERIFIED" : "HIGH",
          evidenceUrl: p.url,
          // Secondary (Wikipedia) sources route to the review queue.
          sourceTypeOverride: p.grade === "A" ? SourceType.ORGANIZATION_DISCLOSURE : SourceType.REPUTABLE_MEDIA,
          sourceProfile: { leadership: true, boardRole: p.boardRole },
        } satisfies NormalizedFact);
      }
    }

    if (section === "governance") {
      // The administrative council (21 MPs chosen by the Eduskunta) is the
      // highest decision-making body of Yle; it supervises Yle. Member edges
      // are maintained by the parliament agent (Eduskunta data).
      facts.push({
        kind: "relationship",
        source: COUNCIL_REF,
        target: YLE_REF,
        relationshipType: RelationshipType.SUPERVISES,
        role: `Ylin päättävä elin — ${yleGovernance.memberCount} jäsentä, eduskunta valitsee`,
        assertedCurrent: true,
        confidence: "VERIFIED",
        evidenceUrl: "https://yle.fi/aihe/about-yle/yles-administrative-council",
        sourceProfile: { governance: true },
      } satisfies NormalizedFact);
    }

    if (section === "finances") {
      const docId = (doc.meta as { docId?: string } | undefined)?.docId;
      const yearDoc = yleFinances.find((f) => f.docId === docId);
      if (!yearDoc) return facts;
      for (const item of yearDoc.items) {
        facts.push({
          kind: "statement",
          entity: YLE_REF,
          fiscalYear: item.year,
          statementKind: item.kind,
          category: item.category,
          categoryLabel: item.categoryLabel,
          amount: item.amountEur,
          currency: "EUR",
          valueType: item.valueType,
          isTotal: item.isTotal ?? false,
          note: item.note ?? null,
          reportUrl: item.url,
          sourceType: SourceType.ANNUAL_REPORT,
          sourceName: item.sourceName,
          publisher: "Yleisradio Oy (yle.fi)",
          dedupeKey: `yle:${item.year}:${item.kind}:${item.category}:${item.url}`,
        });
      }
      for (const flow of yearDoc.flows) {
        facts.push({
          kind: "flow",
          source: STATE_REF,
          target: YLE_REF,
          flowType: "GOVERNMENT_SUBSIDY",
          fundingType: "GRANT",
          amount: flow.amountEur,
          currency: "EUR",
          periodYear: flow.year,
          purpose: flow.purpose,
          confidence: "VERIFIED",
          evidenceUrl: flow.url,
          externalRecordId: `yle-appropriation-${flow.year}`,
          sourceTypeOverride: SourceType.ORGANIZATION_DISCLOSURE,
          dedupeKey: `yle-flow:${flow.year}`,
        } satisfies NormalizedFact);
      }
    }

    return facts;
  },

  async onFactPublished(ctx, fact, entityIds) {
    if (fact.kind !== "relationship") return;
    const yleId = entityIds.target;

    // Organization + MediaOutlet profile, set once when a profile fact lands.
    if (fact.sourceProfile?.yleProfile === true && yleId) {
      await ctx.db.organization.upsert({
        where: { entityId: yleId },
        update: {
          legalForm: yleProfile.legalForm,
          registrationNumber: yleProfile.registrationNumber,
          foundingYear: yleProfile.foundingYear,
          headquarters: yleProfile.headquarters,
          employeeCount: yleProfile.employeeCount,
        },
        create: {
          entityId: yleId,
          legalForm: yleProfile.legalForm,
          registrationNumber: yleProfile.registrationNumber,
          foundingYear: yleProfile.foundingYear,
          headquarters: yleProfile.headquarters,
          employeeCount: yleProfile.employeeCount,
        },
      });
      await ctx.db.mediaOutlet.upsert({
        where: { entityId: yleId },
        update: {
          websiteUrl: yleProfile.websiteUrl,
          mediaOutletType: "BROADCASTER",
          foundingYear: yleProfile.foundingYear,
          countryCode: "FI",
          publishLanguages: yleProfile.publishLanguages,
          fundingModel: yleProfile.fundingModel,
        },
        create: {
          entityId: yleId,
          websiteUrl: yleProfile.websiteUrl,
          mediaOutletType: "BROADCASTER",
          foundingYear: yleProfile.foundingYear,
          countryCode: "FI",
          publishLanguages: yleProfile.publishLanguages,
          fundingModel: yleProfile.fundingModel,
        },
      });
      await ctx.db.entity.update({
        where: { id: yleId },
        data: { description: yleProfile.description, lastVerifiedAt: new Date() },
      });
      for (const alias of yleProfile.aliases) {
        await ctx.db.entityAlias.upsert({
          where: { entityId_name_aliasType: { entityId: yleId, name: alias, aliasType: "NAME_VARIANT" } },
          update: {},
          create: { entityId: yleId, name: alias, aliasType: "NAME_VARIANT" },
        });
      }
    }

    // Leadership → Position rows (Johto / Hallinto tabs).
    const sourceId = entityIds.source;
    const lead = fact.sourceProfile?.leadership === true && yleId && sourceId;
    if (lead && (fact.relationshipType === "WORKS_FOR" || fact.relationshipType === "BOARD_MEMBER_OF" || fact.relationshipType === "CHAIRS")) {
      const role = fact.role ?? "Johtotehtävä";
      const existing = await ctx.db.position.findFirst({
        where: { personEntityId: sourceId, organizationEntityId: yleId, role },
      });
      const isCurrent = fact.assertedCurrent !== false && fact.endDate === null;
      if (existing) {
        await ctx.db.position.update({
          where: { id: existing.id },
          data: {
            startDate: fact.startDate,
            endDate: fact.endDate,
            isCurrent,
            sourceId: ctx.sourceId,
            updatedAt: new Date(),
          },
        });
      } else {
        await ctx.db.position.create({
          data: {
            personEntityId: sourceId,
            organizationEntityId: yleId,
            role,
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

// Keep the source registry and scheduler options in sync with the adapter.
export const yleRunOptions = { concurrency: 2, maxDocsPerTick: 4 } as const;