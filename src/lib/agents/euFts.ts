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
import { EntityType, FlowType, FundingType, SourceType, type Prisma, type PrismaClient } from "@prisma/client";
import type { NormalizedFact, RunContext, SourceAdapter, SourceDocument } from "./types";

const DATASET_URL = (year: number) =>
  `https://ec.europa.eu/budget/financial-transparency-system/download/${year}_FTS_dataset_en.xlsx`;

// Years to ingest, newest first. Only years actually published by the official
// source (data.europa.eu currently goes up to 2023). Each is a separate ~20 MB
// download + stream parse; a failing year never corrupts the others.
const YEARS = [2023, 2022];
const PARSER_VERSION = "eu-fts-2";

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

// The sovereign state itself as a beneficiary (e.g. "Republic of Finland",
// "Suomen valtio"). Deterministic match on the official name field — never
// inferred. FTS lists these as a plain beneficiary with no useful type, which
// otherwise falls through to ORGANIZATION / OTHER.
const SOVEREIGN_STATE_RE =
  /(^|\W)(republic of finland|republique de finlande|suomen tasavalta|suomen valtio)(\W|$)/i;
export function isSovereignFinnishState(name: string): boolean {
  return SOVEREIGN_STATE_RE.test(name);
}

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

export interface FtsRecord {
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

export function recordKey(r: FtsRecord): string {
  const who = vatToYtunnus(r.vat) ?? r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  // Year keeps annual records separate (Phase 5). When the source gives no
  // legal-commitment / budget reference, fall back to a stable hash of the
  // remaining fields so distinct rows are never collapsed.
  const refs = `${r.lc}|${r.budgetRef}`;
  const tail = refs.replace(/\|/g, "") ? refs : `h${simpleHash(`${r.subject}|${r.programme}|${r.amount}|${r.contractType}`)}`;
  return `eu-fts:${r.year}:${tail}:${who}`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
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

// ---------------------------------------------------------------------------
// Resumable discovery (Sprint C2 hotfix).
//
// `discover()` used to re-download + re-stream-parse both ~20 MB XLSX files on
// every tick. On Vercel that alone exceeded the function limit, so the pipeline
// never reached the publish phase and `/foreign` stayed empty forever.
//
// Fix: the first tick that sees an uncached year downloads + parses it and
// persists every parsed record straight away as a PENDING SourceDocument
// (contentHash "" is a sentinel — the collector recomputes it on first real
// processing, so the row reads as "changed" and the flow is published; on a
// second run the hash matches and the row is "unchanged", so nothing is
// duplicated). Later ticks rebuild the descriptor list from those rows with a
// cheap DB read and no network. A year older than the cadence window is
// re-pulled so a genuine monthly refresh still picks up new records.
// ---------------------------------------------------------------------------
const FTS_SOURCE_ID = "eu-fts-agent";
// Just under the "monthly" cadence window (see scheduler CADENCE_MAX_AGE_MS) so
// a scheduled refresh re-downloads instead of serving a stale cache.
export const FTS_CACHE_MAX_AGE_MS = 26 * 24 * 60 * 60 * 1000;

type FtsDb = Pick<PrismaClient, "sourceDocument">;

function descriptorFromRow(r: {
  externalId: string;
  canonicalUrl: string;
  title: string | null;
  metadata: unknown;
}): SourceDocument | null {
  const meta = (r.metadata as { meta?: FtsRecord } | null)?.meta;
  if (!meta) return null;
  return { id: r.externalId, url: r.canonicalUrl, title: r.title ?? "", publishedAt: null, hash: "", meta };
}

/** A year is cached when it has at least one persisted row newer than the cadence window. */
export async function ftsYearCached(db: FtsDb, year: number, now = Date.now()): Promise<boolean> {
  const row = await db.sourceDocument.findFirst({
    where: { ingestionSourceId: FTS_SOURCE_ID, externalId: { startsWith: `eu-fts:${year}:` } },
    select: { firstSeenAt: true },
    orderBy: { firstSeenAt: "desc" },
  });
  return !!row && now - row.firstSeenAt.getTime() < FTS_CACHE_MAX_AGE_MS;
}

/** Rebuild the full descriptor list from persisted SourceDocument rows (no network). */
export async function cachedFtsDescriptors(db: FtsDb): Promise<SourceDocument[]> {
  const rows = await db.sourceDocument.findMany({
    where: { ingestionSourceId: FTS_SOURCE_ID },
    select: { externalId: true, canonicalUrl: true, title: true, metadata: true },
  });
  const out: SourceDocument[] = [];
  for (const r of rows) {
    const d = descriptorFromRow(r);
    if (d) out.push(d);
  }
  return out;
}

/** Persist parsed descriptors up-front so a later tick can skip the download. */
export async function persistFtsDescriptors(db: FtsDb, docs: SourceDocument[]): Promise<number> {
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    const res = await db.sourceDocument.createMany({
      data: slice.map((d) => ({
        ingestionSourceId: FTS_SOURCE_ID,
        externalId: d.id,
        canonicalUrl: d.url,
        documentType: "json",
        title: d.title || null,
        contentHash: "", // sentinel; the collector fills it on first processing
        metadata: { meta: d.meta } as Prisma.InputJsonValue,
        rawJson: (d.meta ?? null) as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    written += res.count;
  }
  return written;
}

function ftsDescriptorsForYear(year: number, records: FtsRecord[]): SourceDocument[] {
  return records.map((r) => ({
    id: recordKey(r),
    url: `${DATASET_URL(year)}#${encodeURIComponent(r.lc || r.budgetRef || r.name)}`,
    title: `EU FTS ${year} — ${r.name} (${r.lc || r.budgetRef})`,
    publishedAt: null,
    hash: "",
    meta: r as unknown,
  }));
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

  async discover(ctx: RunContext): Promise<SourceDocument[]> {
    const db = ctx.db;
    for (const year of YEARS) {
      // Skip the ~20 MB download+parse when this year is already persisted and
      // still inside the cadence window.
      if (await ftsYearCached(db, year)) continue;
      try {
        const path = await ensureXlsx(year, ctx.log);
        const records = await streamFinnishRecords(path, year, ctx.log);
        const yearDocs = ftsDescriptorsForYear(year, records);
        const written = await persistFtsDescriptors(db, yearDocs);
        ctx.log(`FTS ${year}: persisted ${written}/${yearDocs.length} descriptors`);
      } catch (e) {
        // One year failing must not corrupt the others.
        ctx.log(`FTS ${year}: skipped — ${(e as Error).message}`);
      }
    }
    const docs = await cachedFtsDescriptors(db);
    ctx.log(`discovery: ${docs.length} descriptors available (persisted cache)`);
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
    const sovereign = isSovereignFinnishState(r.name);
    const target = {
      type: (sovereign ? EntityType.GOVERNMENT_BODY : EntityType.ORGANIZATION) as EntityType,
      name: r.name,
      jurisdiction: "FI",
      countryCode: "FI",
      entityCategory: sovereign ? ("GOVERNMENT" as const) : categoryOf(r.benefType, r.ngo),
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
        // FTS gives a funding (budget) year and a project period. It does NOT
        // give an award or payment date — so flowDate stays null; the project
        // period lives on periodStart/End and on the Project row.
        startDate: null,
        endDate: null,
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
