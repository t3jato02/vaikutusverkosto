import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { organizationsByCategory } from "@/lib/institutionalPower/institutionQueries";
import type { InstitutionalCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<InstitutionalCategory>([
  "MINISTRY",
  "PRIME_MINISTERS_OFFICE",
  "AGENCY",
  "AUTHORITY",
  "STATE_ENTERPRISE",
  "STATE_OWNED_COMPANY",
  "STATE_SPECIAL_ASSIGNMENT_COMPANY",
  "STATE_INVESTMENT_COMPANY",
  "PUBLIC_FINANCING_INSTITUTION",
  "STATE_FUND",
  "MUNICIPALITY",
  "WELLBEING_SERVICES_COUNTY",
  "MUNICIPAL_OWNED_COMPANY",
  "REGIONAL_COUNCIL",
  "NGO",
  "FOUNDATION",
  "ASSOCIATION",
  "EMPLOYER_ORGANIZATION",
  "TRADE_UNION",
  "PROFESSIONAL_ORGANIZATION",
  "LABOUR_MARKET_CENTRAL_ORGANIZATION",
  "INDUSTRY_ASSOCIATION",
  "CHAMBER_OF_COMMERCE",
  "WORKING_GROUP",
  "ADVISORY_BODY",
  "COMMISSION",
  "COUNCIL",
]);

// Minimal public read endpoint for the UI stream: organisations of an
// institutional category. UI-specific UX is owned by stream D.
export async function GET(req: Request) {
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return tooManyRequests(rl);
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") ?? "").toUpperCase() as InstitutionalCategory;
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "bad_category", categories: [...VALID_CATEGORIES] }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 250);
  const rows = await organizationsByCategory({ category, current: true }, limit);
  return NextResponse.json({ category, categoryLabel: rows[0]?.categoryLabel ?? null, count: rows.length, items: rows });
}