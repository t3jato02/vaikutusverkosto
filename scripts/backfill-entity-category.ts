// Deterministic entity-category backfill (C5 Phase 11).
//   npx tsx scripts/backfill-entity-category.ts          # dry run
//   npx tsx scripts/backfill-entity-category.ts --apply  # write
//
// A rule match replaces only a WEAK current category (null, OTHER, and the
// generic fallbacks COMPANY / NGO). Specific categories set by an adapter or a
// human (GOVERNMENT, STATE_OWNED_COMPANY, UNIVERSITY, FOUNDATION, THINK_TANK,
// MEDIA_ORGANIZATION, INTERNATIONAL_ORGANIZATION, POLITICAL_PARTY,
// RELIGIOUS_ORGANIZATION, GOVERNMENT_AGENCY) are never overwritten.
// Classification is a rule engine over the official name + jurisdiction
// (src/lib/entityCategory.ts) — no LLM.
import "dotenv/config";
import type { EntityCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { classifyEntityCategory } from "@/lib/entityCategory";

const APPLY = process.argv.includes("--apply");
const WEAK = new Set<EntityCategory | null>([null, "OTHER", "COMPANY", "NGO"]);

async function main() {
  const rows = await db.entity.findMany({
    where: { type: { not: "PERSON" } },
    select: { id: true, canonicalName: true, entityCategory: true, countryCode: true, jurisdiction: true },
  });

  const counts: Record<string, number> = {};
  const samples: string[] = [];
  let changed = 0;
  for (const e of rows) {
    if (!WEAK.has(e.entityCategory)) continue;
    const cat = classifyEntityCategory({ name: e.canonicalName, countryCode: e.countryCode, jurisdiction: e.jurisdiction });
    if (!cat || cat === e.entityCategory) continue;
    // Do not downgrade COMPANY/NGO to the other generic fallback.
    if ((e.entityCategory === "COMPANY" || e.entityCategory === "NGO") && (cat === "COMPANY" || cat === "NGO")) continue;
    const key = `${e.entityCategory ?? "NULL"} -> ${cat}`;
    counts[key] = (counts[key] ?? 0) + 1;
    changed++;
    if (samples.length < 45) samples.push(`  ${key.padEnd(34)} ${e.canonicalName.slice(0, 58)}`);
    if (APPLY) await db.entity.update({ where: { id: e.id }, data: { entityCategory: cat } });
  }

  console.log(`non-person entities: ${rows.length}   reclassified: ${changed}${APPLY ? "  (APPLIED)" : "  (dry run)"}`);
  console.log("transitions:");
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(36)} ${v}`);
  console.log("\nsamples:\n" + samples.join("\n"));
  await db.$disconnect();
}

main();
