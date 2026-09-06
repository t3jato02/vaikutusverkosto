/**
 * fix-mojibake.ts — deterministic, re-runnable repair of UTF-8→Latin-1
 * mojibake in text columns.
 *
 * Root cause (fixed in code): src/lib/agents/http.ts previously decoded the
 * Eduskunta API (UTF-8) as ISO-8859-1, so "Työelämä" was stored as
 * "TyÃ¶elÃ¤mÃ¤". This script repairs rows already written that way, using the
 * same proven-lossless-inverse logic as src/lib/encoding.ts.
 *
 * Production is repaired automatically by the SQL migration
 * 20260906120000_repair_utf8_mojibake. This script is the auditable reference
 * implementation and a safety net for ad-hoc runs.
 *
 * Usage:
 *   npx tsx scripts/fix-mojibake.ts            # dry run — report only
 *   npx tsx scripts/fix-mojibake.ts --apply    # write the fixes
 *
 * Idempotent: after a successful --apply, a dry run reports 0 fixable rows.
 */
import { db } from "../src/lib/db";
import { hasMojibake, repairMojibake } from "../src/lib/encoding";

const APPLY = process.argv.includes("--apply");

// [label, delegateName, [textColumns...], idColumn]
const TARGETS: [string, string, string[], string][] = [
  ["Entity", "entity", ["canonicalName", "description", "municipality", "region", "country", "jurisdiction", "subtype"], "id"],
  ["Person", "person", ["profession", "education", "firstName", "lastName", "electoralDistrict"], "entityId"],
  ["Organization", "organization", ["legalForm", "headquarters"], "entityId"],
  ["EntityAlias", "entityAlias", ["name"], "id"],
  ["Relationship", "relationship", ["role", "description", "endedReason"], "id"],
  ["RelationshipCandidate", "relationshipCandidate", ["role", "evidenceTitle", "sourceName", "publisher", "rejectionReason"], "id"],
  ["FinancialFlow", "financialFlow", ["purpose", "description", "rawFundingType"], "id"],
  ["Project", "project", ["name", "description", "programme", "municipality", "locationRegion"], "id"],
  ["Source", "source", ["sourceName", "publisher", "documentTitle"], "id"],
  ["SourceDocument", "sourceDocument", ["title"], "id"],
  ["Evidence", "evidence", ["quotedFragment", "documentTitle"], "id"],
  ["Decision", "decision", ["title", "description", "decisionType", "legalBasis"], "id"],
  ["Position", "position", ["role"], "id"],
  ["ChangeLog", "changeLog", ["description"], "id"],
  ["Event", "event", ["description"], "id"],
  ["Correction", "correction", ["description"], "id"],
];

async function main() {
  let totalFixed = 0;
  let totalUnsafe = 0;

  for (const [label, delegate, cols, idCol] of TARGETS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (db as any)[delegate];
    if (!model) {
      console.log(`- ${label}: SKIP (no delegate)`);
      continue;
    }

    let usableCols = [...cols];
    let rows: Record<string, unknown>[] | null = null;
    for (;;) {
      try {
        rows = await model.findMany({
          select: Object.fromEntries([[idCol, true], ...usableCols.map((c) => [c, true])]),
        });
        break;
      } catch (e) {
        const bad = /Unknown field .(\w+). for/.exec(String((e as Error).message))?.[1];
        if (bad && usableCols.includes(bad)) {
          usableCols = usableCols.filter((c) => c !== bad);
          continue;
        }
        console.log(`- ${label}: SKIP (${String((e as Error).message).replace(/\s+/g, " ").slice(0, 120)})`);
        break;
      }
    }
    if (!rows) continue;

    let fixedHere = 0;
    let unsafeHere = 0;
    for (const row of rows) {
      const patch: Record<string, string> = {};
      for (const c of usableCols) {
        const v = row[c];
        if (typeof v !== "string" || !hasMojibake(v)) continue;
        const fixed = repairMojibake(v);
        if (fixed === v || hasMojibake(fixed)) {
          unsafeHere++;
          console.log(`  UNSAFE ${label}.${c} ${idCol}=${String(row[idCol])}: ${JSON.stringify(v).slice(0, 120)}`);
          continue;
        }
        patch[c] = fixed;
      }
      if (Object.keys(patch).length === 0) continue;
      fixedHere += Object.keys(patch).length;
      if (APPLY) await model.update({ where: { [idCol]: row[idCol] }, data: patch });
    }

    if (fixedHere || unsafeHere) {
      console.log(`- ${label}: ${fixedHere} value(s) ${APPLY ? "fixed" : "fixable"}, ${unsafeHere} unsafe`);
    }
    totalFixed += fixedHere;
    totalUnsafe += unsafeHere;
  }

  console.log(
    `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${totalFixed} value(s) ${APPLY ? "repaired" : "repairable"}, ${totalUnsafe} unsafe.`,
  );
  if (!APPLY && totalFixed > 0) console.log("Re-run with --apply to write these changes.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
