// One-time backfill: set Relationship.percentage on the state OWNS edges that
// were created before ownershipPercent was wired through publish.ts. Values are
// the deterministic figures from the VNK adapter's HOLDINGS table (verbatim from
// "Valtion omistajaohjauksen vuosikertomus 2023"). Matched by the target's
// Y-tunnus so canonical-name variants do not matter. No inference.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

// businessId -> ownership %
const PCT = {
  "2245475-7": 100.0, // Solidium Oy
  "1003521-5": 100.0, // VR-Yhtymä Oyj
  "0109357-9": 100.0, // Posti Group Oyj
  "3007894-1": 100.0, // Gasgrid Finland Oy
  "2302570-2": 100.0, // Finavia Oyj
  "0244984-4": 100.0, // Yleisradio Oy
  "1072894-3": 53.1,  // Fingrid Oyj
  "1852302-9": 44.2,  // Neste Oyj
  "1463611-4": 50.76, // Fortum Oyj
  "0108023-3": 55.9,  // Finnair Oyj
};

const state =
  (await db.entity.findFirst({
    where: { type: "GOVERNMENT_BODY", externalIds: { some: { provider: "vnk", identifier: "suomen-valtio" } } },
    select: { id: true, canonicalName: true },
  })) ??
  (await db.entity.findFirst({ where: { canonicalName: "Suomen valtio" }, select: { id: true, canonicalName: true } }));

if (!state) { console.error("Suomen valtio entity not found"); process.exit(1); }
console.log(`state entity: ${state.canonicalName} (${state.id})`);

const rels = await db.relationship.findMany({
  where: { sourceEntityId: state.id, relationshipType: "OWNS" },
  include: {
    targetEntity: { select: { canonicalName: true, externalIds: { select: { provider: true, identifier: true } } } },
  },
});

let fixed = 0;
for (const r of rels) {
  const yt = r.targetEntity.externalIds.find((x) => x.provider === "ytj")?.identifier;
  const pct = yt ? PCT[yt] : undefined;
  if (pct == null) { console.log(`  ? no figure for ${r.targetEntity.canonicalName} (ytj=${yt ?? "—"}) — skipped`); continue; }
  if (Number(r.percentage ?? NaN) === pct) { console.log(`  = ${r.targetEntity.canonicalName} already ${pct} %`); continue; }
  await db.relationship.update({ where: { id: r.id }, data: { percentage: pct } });
  console.log(`  set ${r.targetEntity.canonicalName.slice(0, 40).padEnd(40)} -> ${pct} %`);
  fixed++;
}
console.log(`\n${fixed} ownership edge(s) backfilled.`);
await db.$disconnect();
