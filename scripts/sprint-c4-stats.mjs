import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const g = (label, p) => p.then((v) => console.log(`${label.padEnd(52)} ${v}`));

const TR = ["REGISTERED_LOBBY_ORGANIZATION","REPRESENTS_INTERESTS_OF","CLIENT_OF","DECLARED_EU_INTEREST","ACCREDITED_REPRESENTATIVE_OF"];
const OWN = ["OWNS","SHAREHOLDER_OF","BENEFICIAL_OWNER_OF"];

await g("Relationships (transparency types, published)", db.relationship.count({ where: { relationshipType: { in: TR }, verificationState: "PUBLISHED" } }));
await g("  REGISTERED_LOBBY_ORGANIZATION", db.relationship.count({ where: { relationshipType: "REGISTERED_LOBBY_ORGANIZATION" } }));
await g("  REPRESENTS_INTERESTS_OF", db.relationship.count({ where: { relationshipType: "REPRESENTS_INTERESTS_OF" } }));
await g("RelationshipCandidate (transparency)", db.relationshipCandidate.count({ where: { relationshipType: { in: TR } } }));
await g("Relationships (OWNS family, published)", db.relationship.count({ where: { relationshipType: { in: OWN }, verificationState: "PUBLISHED" } }));
await g("  OWNS temporalState=CURRENT", db.relationship.count({ where: { relationshipType: "OWNS", temporalState: "CURRENT" } }));
await g("  OWNS with percentage set", db.relationship.count({ where: { relationshipType: "OWNS", percentage: { not: null } } }));
await g("FinancialFlow isForeign=true", db.financialFlow.count({ where: { isForeign: true } }));
await g("  distinct periodYear", db.financialFlow.findMany({ where: { isForeign: true }, distinct: ["periodYear"], select: { periodYear: true } }).then((r) => r.map((x) => x.periodYear).sort().join(",")));
await g("Project count", db.project.count());
await g("IngestionSource enabled", db.ingestionSource.count({ where: { enabled: true } }));
await g("RelationshipCandidate total (all)", db.relationshipCandidate.count());
await g("Entities type=GOVERNMENT_BODY cat=GOVERNMENT", db.entity.count({ where: { type: "GOVERNMENT_BODY", entityCategory: "GOVERNMENT" } }));

const srcs = await db.ingestionSource.findMany({ select: { id: true, enabled: true, lastSuccessAt: true, consecutiveFailures: true }, orderBy: { id: "asc" } });
console.log("\nSources:");
for (const s of srcs) console.log(`  ${s.id.padEnd(26)} enabled=${s.enabled}  lastSuccess=${s.lastSuccessAt?.toISOString().slice(0,10) ?? "—"}  fails=${s.consecutiveFailures}`);

await db.$disconnect();
