/**
 * verify-foreign-prod.mjs — post-EU-FTS-ingestion production verification.
 *
 *   node scripts/verify-foreign-prod.mjs snapshot   # after run 1: record counts
 *   node scripts/verify-foreign-prod.mjs check      # after run 2: assert no growth
 *
 * Read-only: hits only the public production APIs + /foreign HTML.
 */
import fs from "node:fs";

const BASE = "https://vaikutusverkosto.vercel.app";
const SNAP = new URL("./.foreign-prod-snapshot.json", import.meta.url);
const mode = process.argv[2] ?? "check";

const j = async (p) => (await fetch(BASE + p)).json();
const t = async (p) => (await fetch(BASE + p)).text();

const ff = await j("/api/foreign-funding");
const money = await j("/api/money");
const euFunding = (money.byType ?? []).find((x) => x.flowType === "EU_FUNDING");
const foreignHtml = await t("/foreign");

// crude but sufficient: recipients / projects / evidence signals on the page
const hasRecipients = /Suurimmat vastaanottajat/i.test(foreignHtml) && !/—<\/li>\s*<\/ul>/i.test(foreignHtml);
const hasEvidence = /Todisteet \(\d+\)/i.test(foreignHtml) || /Näytä lähde/i.test(foreignHtml);
const emptyState = /Ei vielä dokumentoitua ulkomaista rahoitusta/i.test(foreignHtml);

const now = {
  foreignFundingTotal: ff.total ?? 0,
  foreignFlowRows: (ff.flows ?? []).length,
  euFundingFlows: euFunding?._count?._all ?? 0,
  euFundingSum: euFunding?._sum?.amount ?? "0",
  moneyTypes: (money.byType ?? []).map((x) => x.flowType).sort(),
  hasRecipients,
  hasEvidence,
  emptyState,
};
console.log(JSON.stringify(now, null, 2));

if (mode === "snapshot") {
  fs.writeFileSync(SNAP, JSON.stringify(now, null, 2));
  console.log("\nsnapshot saved. Run eu-fts-agent AGAIN, then: node scripts/verify-foreign-prod.mjs check");
  process.exit(0);
}

// mode === "check"
const problems = [];
if (now.foreignFundingTotal <= 0) problems.push("foreign-funding total still 0");
if (now.euFundingFlows <= 0) problems.push("/api/money has no EU_FUNDING flows");
if (now.emptyState) problems.push("/foreign still shows the empty state");
if (!now.hasRecipients) problems.push("/foreign has no top recipients");

let prev = null;
try {
  prev = JSON.parse(fs.readFileSync(SNAP, "utf8"));
} catch {
  console.log("\n(no run-1 snapshot; skipping dedup/idempotency comparison)");
}
if (prev) {
  const grewTotal = Number(now.foreignFundingTotal) > Number(prev.foreignFundingTotal) * 1.001;
  const grewFlows = now.euFundingFlows > prev.euFundingFlows;
  if (grewTotal || grewFlows) {
    problems.push(
      `2nd run added rows — NOT idempotent: EU_FUNDING flows ${prev.euFundingFlows} -> ${now.euFundingFlows}, total ${prev.foreignFundingTotal} -> ${now.foreignFundingTotal}`,
    );
  } else {
    console.log(
      `\nDEDUP OK: EU_FUNDING flows stable at ${now.euFundingFlows}, total stable at ${now.foreignFundingTotal}.`,
    );
  }
}

console.log(problems.length ? "\nFAIL:\n - " + problems.join("\n - ") : "\nALL FOREIGN CHECKS PASS");
process.exit(problems.length ? 1 : 0);
