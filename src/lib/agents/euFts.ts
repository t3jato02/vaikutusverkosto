// EU Financial Transparency System (FTS) adapter.
// Source: official annual datasets, https://ec.europa.eu/budget/financial-transparency-system/
//         (OFFICIAL_REGISTER). Format: XLSX, one file per year, stable URLs
//         mirrored on data.europa.eu.
//
// Scope: EU budget commitments/contracts whose *Beneficiary country* is Finland.
// Every such record becomes an evidence-backed FinancialFlow
//   European Commission → (GRANT|PROCUREMENT) → Finnish beneficiary
// with funderCountryCode "EU" and isForeign = true, optionally linked to a
// Project. Deterministic parse of structured official fields → auto-publishes
// SOURCE_CONFIRMED. Nothing is inferred beyond the record.

import { mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EntityType, FlowType, FundingType, SourceType } from "@prisma/client";
import type { NormalizedFact, SourceAdapter, SourceDocument } from "./types";

const DATASET_URL = (year: number) =>
  `https://ec.europa.eu/budget/financial-transparency-system/download/${year}_FTS_dataset_en.xlsx`;

// Years to ingest. Keep small; each is a ~20 MB download + stream parse.
const YEARS = [2023];
const PARSER_VERSION = "eu-fts-1";

const EC_REF = {
  type: EntityType.GOVERNMENT_BODY,
  name: "Euroopan komissio",
  subtype: "EU:n toimielin",
  jurisdiction: "EU",
  countryCode: "EU",
  entityCategory: "INTERNATIONAL_ORGANIZATION" as const,
  description: "Euroopan komissio — EU:n toimeenpaneva elin ja EU-budjetin toteuttaja.",
  externalId: { provider: "eu-fts", identifier: "european-commission" },
} as const;

function categoryOf(benefType: string, ngo: string):
  | "GOVERNMENT" | "GOVERNMENT_AGENCY" | "COMPANY" | "FOUNDATION" | "NGO" | "UNIVERSITY" | "OTHER" {
  const b = benefType.toLowerCase();
  if (/member state|public body|public authorit|governmental/.test(b)) return "GOVERNMENT_AGENCY";
  if (/universit|higher education|research organis/.test(b)) return "UNIVERSITY";
  if (/foundation/.test(b)) return "FOUNDATION";
  if (/non.?profit|non.?governmental|ngo|association/.test(b) || /yes/i.test(ngo)) return "NGO";
  if (/company|companies|smes?|private/.test(b)) return "COMPANY";
  return "OTHER";
}

interface FtsRecord {
  year: number;
  lc: string;
  budgetRef: string;
  name: string;
  vat: string;
  ngo: string;
  city: string;
  amount: number;
  expenseType: string;
  projectId: string;
  acronym: string;
  subject: string;
  programme: string;
  dept: string;
  benefType: string;
  start: number | null;
  end: number | null;
  contractType: string;
}

/** Excel serial date → JS Date (UTC). */
function serialToDate(n: number | null): Date | null {
  if (!n || !Number.isFinite(n) || n < 20000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
}

const NA = /^(n\/?a|-|not applicable|not-applicable)/i;
function clean(v: unknown): string {
  const s = String(v ?? "").trim();
  return NA.test(s) ? "" : s;
}

/** Finnish VAT "FI01234567" → Y-tunnus "0123456-7". */
function vatToYtunnus(vat: string): string | null {
  const m = vat.replace(/\s+/g, "").toUpperCase().match(/^FI(\d{8})$/);
  if (!m) return null;
  return `${m[1].slice(0, 7)}-${m[1].slice(7)}`;
}

function fundingTypeOf(contractType: string, expenseType: string): { ft: FundingType; flow: FlowType } {
  const c = contractType.toLowerCase();
  if (/grant/.test(c)) return { ft: "GRANT", flow: "EU_FUNDING" };
  if (/procurement|service|supply|works|contract/.test(c)) return { ft: "PROCUREMENT", flow: "PROCUREMENT" };
  if (/prize/.test(c)) return { ft: "OTHER", flow: "EU_FUNDING" };
  if (/expert|advisory/.test(c)) return { ft: "PROCUREMENT", flow: "CONSULTING_PAYMENT" };
  if (/administrative/i.test(expenseType)) return { ft: "OTHER", flow: "OTHER" };
  return { ft: "GRANT", flow: "EU_FUNDING" };
}

let cacheDir: string | null = null;
async function ensureXlsx(year: number, log: (m: string) => void): Promise<string> {
  if (!cacheDir) cacheDir = mkdtempSync(join(tmpdir(), "vk-fts-"));
  const path = join(cacheDir, `${year}.xlsx`);
  if (existsSync(path) && statSync(path).size > 1_000_000) return path;
  log(`downloading FTS ${year} …`);
  const res = await fetch(DATASET_URL(year), { redirect: "follow" });
  if (!res.ok) throw new Error(`FTS ${year}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, buf);
  log(`FTS ${year}: ${(buf.length / 1e6).toFixed(1)} MB`);
  return path;
}

async function streamFinnishRecords(path: string, year: number, log: (m: string) => void): Promise<FtsRecord[]> {
  const ExcelJS = (await import("exceljs")).default;
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    entries: "emit",
    sharedStrings: "cache",
    worksheets: "emit",
    styles: "ignore",
    hyperlinks: "ignore",
  });
  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  const out: FtsRecord[] = [];
  for await (const ws of reader) {
    for await (const row of ws) {
      const v = row.values as unknown[];
      if (!header) {
        header = v.map((x) => (x == null ? "" : String(x).trim()));
        header.forEach((h, i) => (idx[h] = i));
        continue;
      }
      const g = (name: string) => v[idx[name]];
      if (String(g("Beneficiary country") ?? "").trim() !== "Finland") continue;
      const amount = Number(g("Beneficiary’s contracted amount (EUR)") ?? g("Beneficiary's contracted amount (EUR)") ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out.push({
        year,
        lc: clean(g("Reference of the Legal Commitment (LC)")),
        budgetRef: clean(g("Reference (Budget)")),
        name: String(g("Name of beneficiary") ?? "").trim(),
        vat: clean(g("VAT number of beneficiary")),
        ngo: String(g("Non-governmental organisation (NGO)") ?? "").trim(),
        city: clean(g("City")),
        amount,
        expenseType: clean(g("Expense type")),
        projectId: clean(g("Project ID")),
        acronym: clean(g("Project Acronym")),
        subject: clean(g("Subject of grant or contract")),
        programme: clean(g("Programme name")),
        dept: clean(g("Responsible department")),
        benefType: clean(g("Beneficiary type")),
        start: Number(g("Project start date")) || null,
        end: Number(g("Project end date")) || null,
        contractType: clean(g("Type of contract*")) || clean(g("Type of contract")),
      });
    }
  }
  log(`FTS ${year}: ${out.length} Finnish beneficiary records`);
  return out;
}

function recordKey(r: FtsRecord): string {
  const who = vatToYtunnus(r.vat) ?? r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `eu-fts:${r.year}:${r.lc || "nolc"}:${r.budgetRef || "nobr"}:${who}`;
}

function projectRefOf(r: FtsRecord) {
  // Prefer an explicit call/project id embedded in the subject ("101099693 - ACR - Title").
  const m = r.subject.match(/^(\d{6,})\s*[-–]\s*([A-Z0-9_]+)\s*[-–]\s*(.+)$/);
  const sid = m ? `eu:${m[1]}` : r.projectId ? `eu:${r.projectId}` : null;
  if (!sid) return undefined;
  return {
    sourceIdentifier: sid,
    name: m ? `${m[2]} — ${m[3]}`.slice(0, 200) : r.acronym || r.subject.slice(0, 200),
    programme: r.programme || null,
    description: r.subject || null,
    startDate: serialToDate(r.start),
    endDate: serialToDate(r.end),
    locationCountry: "FI",
    municipality: r.city ? r.city.replace(/\s+[A-Z]{2}$/, "").trim() : null,
  };
}

export const euFtsAdapter: SourceAdapter = {
  id: "eu-fts-agent",
  name: "EU Financial Transparency System — suomalaiset EU-varojen saajat",
  sourceType: SourceType.OFFICIAL_REGISTER,
  schedule: "weekly",
  baseUrl: "https://ec.europa.eu/budget/financial-transparency-system/",
  publisher: "Euroopan komissio — DG Budget",
  reliabilityTier: "OFFICIAL_REGISTER",
  format: "PDF", // XLSX annual datasets
  updateCadence: "monthly",
  termsUrl: "https://commission.europa.eu/legal-notice_en",
  notes:
    "EU-budjetin sitoumus- ja sopimusrivit, joiden edunsaajan maa on Suomi. Deterministinen " +
    "XLSX-jäsennys. Jokaisesta rivistä evidensoitu FinancialFlow (Euroopan komissio → suomalainen " +
    "saaja), funderCountryCode = EU, isForeign = true. Vain amount > 0.",

  async discover(ctx): Promise<SourceDocument[]> {
    const docs: SourceDocument[] = [];
    for (const year of YEARS) {
      const path = await ensureXlsx(year, ctx.log);
      const records = await streamFinnishRecords(path, year, ctx.log);
      for (const r of records) {
        docs.push({
          id: recordKey(r),
          url: `${DATASET_URL(year)}#${encodeURIComponent(r.lc || r.budgetRef || r.name)}`,
          title: `EU FTS ${year} — ${r.name} (${r.lc || r.budgetRef})`,
          publishedAt: null,
          hash: "",
          meta: r,
        });
      }
    }
    return docs;
  },

  async fetch(_ctx, doc): Promise<unknown> {
    // Data already gathered in discovery; the descriptor carries it.
    return doc.meta;
  },

  async parse(_ctx, doc, raw): Promise<NormalizedFact[]> {
    const r = raw as FtsRecord;
    if (!r || !(r.amount > 0) || !r.name) return [];
    const ytunnus = vatToYtunnus(r.vat);
    const { ft, flow } = fundingTypeOf(r.contractType, r.expenseType);
    const target = {
      type: EntityType.ORGANIZATION as EntityType,
      name: r.name,
      jurisdiction: "FI",
      countryCode: "FI",
      entityCategory: categoryOf(r.benefType, r.ngo),
      municipality: r.city ? r.city.replace(/\s+[A-Z]{2}$/, "").trim() : null,
      ...(ytunnus ? { externalId: { provider: "ytj", identifier: ytunnus } } : {}),
    };
    const start = serialToDate(r.start);
    const end = serialToDate(r.end);
    return [
      {
        kind: "flow",
        source: { ...EC_REF },
        target,
        flowType: flow,
        fundingType: ft,
        rawFundingType: r.contractType || r.expenseType || null,
        amount: Math.round(r.amount * 100) / 100,
        currency: "EUR",
        funderCountryCode: "EU",
        recipientCountryCode: "FI",
        startDate: start,
        endDate: end,
        periodStart: start,
        periodEnd: end,
        periodYear: r.year,
        purpose: r.subject || r.programme || null,
        confidence: "VERIFIED",
        evidenceUrl: DATASET_URL(r.year),
        externalRecordId: doc.id,
        extractionMethod: "deterministic-parser",
        extractorVersion: PARSER_VERSION,
        projectRef: projectRefOf(r),
      },
    ];
  },
};
