// Procurement Adapter — Finnish public procurement data.
// Source: Tutki hankintoja (Valtiovarainministeriö), official public service for exploring
// Finnish public procurement: https://tutkihankintoja.fi/
// Backend API: https://hns-th-spring-prod-api.azurewebsites.net (anonymous read key embedded
// in the public frontend). Data: procurement vendors, business IDs (Y-tunnus) and total
// amounts per year. Confidential rows are never published.

import { EntityType, FlowType, SourceType } from "@prisma/client";
import { fetchJsonUtf8Retry } from "./http";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const API_BASE = "https://hns-th-spring-prod-api.azurewebsites.net";
const PUBLIC_KEY = "7215f8f3b03b49f68855f801a2bf725c";
const SITE_URL = "https://tutkihankintoja.fi/";
const PAGE_SIZE = 30;
// The source returns the same top vendors regardless of page → single page per year.
const MAX_PAGES = 1;

const AGGREGATE_PAYER = {
  type: EntityType.GOVERNMENT_BODY,
  name: "Julkiset hankinnat – Suomi (aggregaatti)",
  jurisdiction: "FI",
  externalId: { provider: "tutkihankintoja", identifier: "aggregate-payer" },
  description:
    "Suomen julkisten hankintojen kokonaisuus (aggregaatti). Summat edustavat kaikkien julkisten hankintayksiköiden toimittajille maksamia kokonaisarvoja. Lähde: tutkihankintoja.fi.",
};

interface VendorRow {
  name: string;
  businessId: string | null;
  industry: string | null;
  sum: number;
}

interface VendorsPage {
  activeYear: number;
  table?: { data?: unknown[][] };
}

interface RowCell {
  value?: string | number | null;
  extra?: string | null;
}

const CONFIDENTIAL_NAMES = new Set(["Salassa pidettävä", "Confidential", "Sekretessbelagd"]);

function parseRow(row: unknown[]): VendorRow | null {
  if (!Array.isArray(row) || row.length < 3) return null;
  const nameCell = row[0] as RowCell | undefined;
  const industryCell = row[1] as RowCell | undefined;
  const sumCell = row[2] as RowCell | undefined;
  const name = String(nameCell?.value ?? "").trim();
  if (!name || CONFIDENTIAL_NAMES.has(name)) return null;
  const extra = String(nameCell?.extra ?? "");
  const m = extra.match(/Y-Tunnus:\s*([0-9-]+)/);
  const businessId = m ? m[1] : null;
  const industry = industryCell?.value ? String(industryCell.value) : null;
  const sum = Number(sumCell?.value);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return { name, businessId, industry, sum };
}

export const procurementAdapter: SourceAdapter = {
  id: "procurement-agent",
  name: "Tutki hankintoja — julkisten hankintojen toimittajat",
  sourceType: SourceType.PROCUREMENT_RECORD,
  schedule: "weekly",
  baseUrl: SITE_URL,
  publisher: "Valtiovarainministeriö / Tutki hankintoja",
  reliabilityTier: "OFFICIAL_REGISTER",
  format: "API",
  updateCadence: "weekly",
  termsUrl: "https://tutkihankintoja.fi/",
  notes:
    "Valtiovarainministeriön virallinen palvelu. Taustarajapinta käyttää julkisessa " +
    "frontendissä upotettua anonyymiä lukuavainta. Salassa pidettävät rivit ei koskaan julkaista.",

  async discover(ctx) {
    const latest = await fetchLatestYear();
    const docs: SourceDocument[] = [];
    for (const year of [latest, latest - 1]) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        docs.push({
          id: `vendors-${year}-p${page}`,
          url: `${API_BASE}/index/vendors?page=${page}&size=${PAGE_SIZE}&year=${year}`,
          title: `Julkisten hankintojen toimittajat ${year} (sivu ${page})`,
          hash: `vendors-${year}-p${page}`,
          meta: { year, page },
        });
      }
    }
    ctx.log(`${docs.length} procurement pages to scan`);
    return docs;
  },

  async fetch(_ctx, doc) {
    return fetchJsonUtf8Retry<VendorsPage>(doc.url, {
      maxRetries: 3,
      headers: { "Ocp-Apim-Subscription-Key": PUBLIC_KEY },
    });
  },

  async parse(ctx, doc, raw) {
    const data = raw as VendorsPage;
    const year = (doc.meta as { year: number }).year;
    const facts: NormalizedFact[] = [];
    for (const row of data.table?.data ?? []) {
      const vendor = parseRow(row);
      if (!vendor) continue;
      facts.push({
        kind: "flow",
        source: AGGREGATE_PAYER,
        target: {
          type: EntityType.COMPANY,
          name: vendor.name,
          jurisdiction: "FI",
          businessId: vendor.businessId,
          description: vendor.industry ? `Päätoimiala: ${vendor.industry}` : null,
        },
        flowType: FlowType.PROCUREMENT,
        amount: vendor.sum,
        currency: "EUR",
        periodYear: year,
        periodStart: new Date(Date.UTC(year, 0, 1)),
        periodEnd: new Date(Date.UTC(year, 11, 31)),
        purpose: `Julkisten hankintojen kokonaisarvo toimittajalle (vuosi ${year})`,
        confidence: "HIGH",
        evidenceUrl: SITE_URL,
      });
    }
    ctx.log(`year ${year} page ${(doc.meta as { page: number }).page}: ${facts.length} flows`);
    return facts;
  },
};

async function fetchLatestYear(): Promise<number> {
  const data = await fetchJsonUtf8Retry<VendorsPage>(`${API_BASE}/index/vendors?page=1&size=1`, {
    maxRetries: 3,
    headers: { "Ocp-Apim-Subscription-Key": PUBLIC_KEY },
  });
  return data.activeYear ?? new Date().getFullYear();
}