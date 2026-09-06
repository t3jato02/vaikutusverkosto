// Phase 18 — reclassify the Finnish State beneficiary rows that the FTS parser
// left as ORGANIZATION / OTHER. Deterministic name match on the official EU-FTS
// beneficiary name; no inference. Type -> GOVERNMENT_BODY, category -> GOVERNMENT.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const RE = /(^|\W)(republic of finland|republique de finlande|suomen tasavalta|suomen valtio)(\W|$)/i;

const candidates = await db.entity.findMany({
  where: {
    countryCode: "FI",
    OR: [
      { canonicalName: { contains: "REPUBLIC OF FINLAND", mode: "insensitive" } },
      { canonicalName: { contains: "SUOMEN TASAVALTA", mode: "insensitive" } },
      { canonicalName: { contains: "SUOMEN VALTIO", mode: "insensitive" } },
    ],
  },
  select: { id: true, canonicalName: true, type: true, entityCategory: true },
});

let fixed = 0;
for (const e of candidates) {
  if (!RE.test(e.canonicalName)) continue;
  if (e.type === "GOVERNMENT_BODY" && e.entityCategory === "GOVERNMENT") continue;
  await db.entity.update({
    where: { id: e.id },
    data: { type: "GOVERNMENT_BODY", entityCategory: "GOVERNMENT" },
  });
  console.log(`fixed: ${e.canonicalName}  (${e.type}/${e.entityCategory} -> GOVERNMENT_BODY/GOVERNMENT)`);
  fixed++;
}
console.log(`\n${fixed} entit${fixed === 1 ? "y" : "ies"} reclassified.`);
await db.$disconnect();
