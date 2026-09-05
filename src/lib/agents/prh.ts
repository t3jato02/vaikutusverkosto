// PRH / YTJ Adapter — Finnish Business Information System open data (v3).
// Source: https://avoindata.prh.fi/opendata-ytj-api/v3/  (OFFICIAL_REGISTER).
//
// This adapter does not create relationships. It reconciles ORGANISATION /
// COMPANY identity against the official register: confirms the Y-tunnus, adds
// registered / former / auxiliary names as aliases, fills domicile + legal form
// when unknown, and attaches a `prh` external identifier. Every change is an
// evidence-backed ChangeLog entry. It is also used by entity resolution
// (Y-tunnus is a strong identifier).

import { SourceType } from "@prisma/client";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const API = "https://avoindata.prh.fi/opendata-ytj-api/v3/companies";

interface PrhName {
  name: string;
  type: string; // "1" registered trade name, "2" parallel, "3" auxiliary
  registrationDate?: string;
  endDate?: string;
}
interface PrhAddress {
  postCode?: string;
  postOffices?: { city?: string; languageCode?: string }[];
  type?: string;
}
interface PrhCompany {
  businessId?: { value?: string; registrationDate?: string };
  names?: PrhName[];
  companyForms?: { descriptions?: { languageCode?: string; description?: string }[] }[];
  addresses?: PrhAddress[];
}
interface PrhResponse {
  totalResults?: number;
  companies?: PrhCompany[];
}

function currentName(names: PrhName[] | undefined): string | null {
  const reg = (names ?? []).filter((n) => n.type === "1" && !n.endDate);
  return reg[0]?.name?.trim() || null;
}

function domicile(addresses: PrhAddress[] | undefined): string | null {
  for (const a of addresses ?? []) {
    const city = a.postOffices?.find((p) => p.languageCode === "1")?.city ?? a.postOffices?.[0]?.city;
    if (city) return city.trim();
  }
  return null;
}

export const prhAdapter: SourceAdapter = {
  id: "prh-agent",
  name: "PRH / YTJ — yritysten viralliset perustiedot",
  sourceType: SourceType.OFFICIAL_REGISTER,
  schedule: "weekly",
  baseUrl: API,
  publisher: "Patentti- ja rekisterihallitus / Verohallinto (avoindata.prh.fi)",
  reliabilityTier: "OFFICIAL_REGISTER",
  format: "API",
  updateCadence: "weekly",
  termsUrl: "https://www.prh.fi/fi/tietosuoja_ja_avoin_data.html",
  notes:
    "YTJ:n avoin rajapinta (CC BY 4.0). Käytetään organisaatioiden identiteetin " +
    "vahvistamiseen (Y-tunnus, viralliset ja aiemmat nimet, kotipaikka, yhtiömuoto) " +
    "ja entity resolutioniin. Ei luo suhteita.",

  async discover(ctx): Promise<SourceDocument[]> {
    // One document per known Y-tunnus in our graph.
    const ids = await ctx.db.externalIdentifier.findMany({
      where: { provider: "ytj" },
      select: { identifier: true, entityId: true },
      orderBy: { identifier: "asc" },
    });
    ctx.log(`PRH: ${ids.length} Y-tunnus to reconcile`);
    return ids.map((r) => ({
      id: `prh:${r.identifier}`,
      url: `${API}?businessId=${encodeURIComponent(r.identifier)}`,
      title: `PRH ${r.identifier}`,
      hash: "", // computed by the collector from the fetched payload
      meta: { businessId: r.identifier, entityId: r.entityId },
    }));
  },

  async fetch(ctx, doc): Promise<unknown> {
    const { guardedFetch } = await import("@/lib/ingestion/fetch");
    const payload = await guardedFetch(doc.url, {
      timeoutMs: 20_000,
      headers: { "User-Agent": "vaikutusverkosto/1.0 (+https://vaikutusverkosto.vercel.app)" },
    });
    return payload.json;
  },

  async parse(ctx, doc, raw): Promise<NormalizedFact[]> {
    const meta = doc.meta as { businessId: string; entityId: string } | undefined;
    if (!meta) return [];
    const res = raw as PrhResponse;
    const company = res.companies?.[0];
    if (!company) {
      ctx.log(`PRH: no company for ${meta.businessId}`);
      return [];
    }

    const entity = await ctx.db.entity.findUnique({
      where: { id: meta.entityId },
      select: { id: true, canonicalName: true, municipality: true, subtype: true },
    });
    if (!entity) return [];

    const before = { canonicalName: entity.canonicalName, municipality: entity.municipality, subtype: entity.subtype };
    const changes: string[] = [];

    // 1. Ensure a `prh` external identifier (strong id for resolution).
    await ctx.db.externalIdentifier.upsert({
      where: { provider_identifier: { provider: "prh", identifier: meta.businessId } },
      update: {},
      create: { provider: "prh", identifier: meta.businessId, entityId: entity.id },
    });

    // 2. Names → aliases (registered, former, auxiliary). Never silently rename.
    const names = company.names ?? [];
    for (const n of names) {
      const name = n.name?.trim();
      if (!name || name.toLowerCase() === entity.canonicalName.toLowerCase()) continue;
      const aliasType = n.endDate ? "PREVIOUS_NAME" : n.type === "1" ? "NAME_VARIANT" : "COMMON_NAME";
      const created = await ctx.db.entityAlias.upsert({
        where: { entityId_name_aliasType: { entityId: entity.id, name, aliasType } },
        update: {},
        create: { entityId: entity.id, name, aliasType },
        select: { id: true },
      });
      if (created) changes.push(`alias:${aliasType}:${name}`);
    }

    // 3. Domicile + legal form when currently unknown (do not overwrite).
    const city = domicile(company.addresses);
    const form =
      company.companyForms?.[0]?.descriptions?.find((d) => d.languageCode === "1")?.description ??
      company.companyForms?.[0]?.descriptions?.[0]?.description ??
      null;
    const patch: Record<string, unknown> = {};
    if (city && !entity.municipality) patch.municipality = city;
    if (form && !entity.subtype) patch.subtype = form;
    const officialName = currentName(names);
    if (officialName && officialName.toLowerCase() !== entity.canonicalName.toLowerCase()) {
      changes.push(`name-mismatch:registry="${officialName}" graph="${entity.canonicalName}"`);
    }

    if (Object.keys(patch).length) {
      await ctx.db.entity.update({ where: { id: entity.id }, data: { ...patch, lastVerifiedAt: new Date() } });
      changes.push(...Object.entries(patch).map(([k, v]) => `${k}:${String(v)}`));
    } else {
      await ctx.db.entity.update({ where: { id: entity.id }, data: { lastVerifiedAt: new Date() } });
    }

    if (changes.length) {
      await ctx.db.changeLog.create({
        data: {
          eventType: "ENTITY_UPDATED",
          entityId: entity.id,
          description: `PRH-täsmäytys (${meta.businessId}): ${changes.slice(0, 12).join("; ")}`,
          beforeData: before,
          afterData: { ...before, ...patch, prhNames: names.map((n) => n.name) },
          occurredAt: new Date(),
        },
      });
      ctx.stats.updated += 1;
      ctx.log(`PRH: reconciled ${meta.businessId} (${changes.length} change(s))`);
    }
    return [];
  },
};
