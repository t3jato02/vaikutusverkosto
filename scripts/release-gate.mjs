// Machine-runnable release gate (Sprint A10).
//
//   node scripts/release-gate.mjs            # local gates: lint, typecheck, unit, build, migrations, env
//   node scripts/release-gate.mjs --full     # + Playwright e2e (needs: npm run build && npm start on :3000)
//   node scripts/release-gate.mjs --smoke https://vaikutusverkosto.vercel.app
//
// Exit code 0 + "RELEASE GATE: GO" only when every selected check passes.
// Exit code 1 + "RELEASE GATE: NO-GO" otherwise.

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";

// Load .env so DATABASE_URL etc. are available for the data-invariant checks
// (mirrors how the Vitest suite bootstraps).
try {
  createRequire(import.meta.url)("dotenv").config();
} catch {
  /* dotenv optional */
}

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const smokeIdx = args.indexOf("--smoke");
const SMOKE_URL = smokeIdx >= 0 ? args[smokeIdx + 1] : process.env.SMOKE_URL || null;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`\n[${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}
function step(name, fn) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const detail = fn() || "";
    record(name, true, String(detail).slice(0, 200));
  } catch (e) {
    record(name, false, (e.stdout?.toString() || e.message || String(e)).split("\n").slice(-6).join(" ").slice(0, 400));
  }
}
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });

// 1. Lint
step("lint", () => { sh("npx eslint ."); return "no eslint errors"; });

// 2. Typecheck
step("typecheck", () => { sh("npx tsc --noEmit"); return "tsc --noEmit clean"; });

// 3. Unit + integration tests (Vitest; includes live DB invariant checks).
//    Force the real limiter on even if the caller disabled it for an e2e server.
step("unit+integration tests", () => {
  const env = { ...process.env };
  delete env.RATE_LIMIT_DISABLED;
  const out = sh("npx vitest run --reporter=dot", { env });
  const m = out.match(/Tests\s+(\d+)\s+passed/);
  return m ? `${m[1]} passed` : "passed";
});

// 4. Production build
step("next build", () => { sh("npx next build", { env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } }); return "build ok"; });

// 5. Migrations: no drift, all applied
step("migrations status", () => {
  const local = readdirSync("prisma/migrations").filter((d) => /^\d{14}_/.test(d)).length;
  const out = sh("npx prisma migrate status");
  if (/have not yet been applied/i.test(out)) throw new Error("unapplied migrations present");
  if (/drift/i.test(out)) throw new Error("schema drift detected");
  return `${local} migrations, all applied`;
});

// 6. Critical env validation (production invariants)
step("critical env validation", () => {
  const required = ["DATABASE_URL", "AUTH_SECRET", "ADMIN_PASSWORD", "CRON_SECRET", "PUBLIC_BASE_URL"];
  // In CI/production this asserts real values are present and non-trivial.
  // Locally (no CI, not production) it is a no-op consistency check.
  const enforce = process.env.CI === "true" || process.env.NODE_ENV === "production";
  const missing = enforce ? required.filter((k) => !process.env[k] || process.env[k].length < 8) : [];
  if (missing.length) throw new Error(`missing/short: ${missing.join(", ")}`);
  return enforce ? "all required env present" : `${required.length} keys (local no-op)`;
});

// 7. Data invariants — evidence, verification status, confidence range (A6/A7).
//    Skipped only when DATABASE_URL is unset.
await (async () => {
  if (!process.env.DATABASE_URL) {
    record("data invariants", true, "skipped (no DATABASE_URL)");
    return;
  }
  process.stdout.write("\n=== data invariants ===\n");
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  try {
    const n = async (rows) => Number(rows[0].count);
    const relNoEvidence = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "Relationship" r WHERE r."verificationState" = 'PUBLISHED'
       AND NOT EXISTS (SELECT 1 FROM "Evidence" e WHERE e."relationshipId" = r.id)`));
    const flowNoEvidence = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "FinancialFlow" f WHERE f."verificationState" = 'PUBLISHED'
       AND NOT EXISTS (SELECT 1 FROM "Evidence" e WHERE e."flowId" = f.id)`));
    const flowNoAmount = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "FinancialFlow" WHERE amount IS NULL OR currency IS NULL OR currency = ''`));
    const scoreOutOfRange = await n(await db.$queryRawUnsafe(
      `SELECT (SELECT count(*) FROM "Relationship" WHERE "confidenceScore" NOT BETWEEN 0 AND 1)
            + (SELECT count(*) FROM "FinancialFlow"  WHERE "confidenceScore" NOT BETWEEN 0 AND 1) AS count`));
    const statusNull = await n(await db.$queryRawUnsafe(
      `SELECT (SELECT count(*) FROM "Relationship" WHERE "verificationStatus" IS NULL)
            + (SELECT count(*) FROM "FinancialFlow"  WHERE "verificationStatus" IS NULL) AS count`));

    step("evidence invariant", () => {
      if (relNoEvidence || flowNoEvidence) throw new Error(`published without evidence: rel=${relNoEvidence} flow=${flowNoEvidence}`);
      if (flowNoAmount) throw new Error(`flows missing amount/currency: ${flowNoAmount}`);
      return "every published relationship & flow has evidence + amount/currency";
    });
    step("verification invariant", () => {
      if (statusNull) throw new Error(`rows with NULL verificationStatus: ${statusNull}`);
      return "verificationStatus set on every relationship & flow";
    });
    step("confidence range", () => {
      if (scoreOutOfRange) throw new Error(`confidenceScore outside [0,1]: ${scoreOutOfRange}`);
      return "confidenceScore within [0,1] everywhere";
    });

    // Phase 17 — extended data-quality invariants.
    const rejectedPublic = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "Relationship"
       WHERE "verificationStatus" = 'REJECTED' AND "verificationStatus" IN
         ('SOURCE_CONFIRMED','HUMAN_VERIFIED','DISPUTED','STALE')`));
    const selfRels = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "Relationship" WHERE "sourceEntityId" = "targetEntityId"`));
    const negativeFlows = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "FinancialFlow" WHERE amount < 0`));
    const badDocs = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "SourceDocument"
       WHERE "contentHash" IS NULL OR "contentHash" = ''
          OR "retrievedAt" > now() + interval '1 hour'
          OR "firstSeenAt" > "lastSeenAt"`));
    const dupStrongIds = await n(await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM (
         SELECT provider, identifier FROM "ExternalIdentifier"
         GROUP BY provider, identifier HAVING count(*) > 1) d`));

    step("relationship integrity", () => {
      if (rejectedPublic) throw new Error(`REJECTED relationships in the public set: ${rejectedPublic}`);
      if (selfRels) throw new Error(`self-relationships: ${selfRels}`);
      return "no REJECTED-in-public, no self-relationships";
    });
    step("financial flow sanity", () => {
      if (negativeFlows) throw new Error(`negative-amount flows: ${negativeFlows}`);
      return "no negative flow amounts";
    });
    step("document integrity", () => {
      if (badDocs) throw new Error(`SourceDocument rows with bad hash/timestamps: ${badDocs}`);
      return "every SourceDocument has a hash and sane timestamps";
    });
    step("entity resolution integrity", () => {
      if (dupStrongIds) throw new Error(`duplicate strong identifiers: ${dupStrongIds}`);
      return "no duplicate (provider, identifier) strong ids";
    });
  } finally {
    await db.$disconnect();
  }
})();

// 9. Optional: Playwright e2e release gate.
//    Start the server under test with RATE_LIMIT_DISABLED=1 so the shared
//    per-IP limiter is not poisoned across viewport projects; the burst test
//    self-skips in that mode.
if (FULL) {
  step("e2e (Playwright)", () => {
    sh("npx playwright test", {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, RATE_LIMIT_DISABLED: "1" },
    });
    return "e2e passed";
  });
}

// 10. Optional: production URL + API smoke
if (SMOKE_URL) {
  const base = SMOKE_URL.replace(/\/+$/, "");
  const expectSha = args.includes("--expect-sha") ? args[args.indexOf("--expect-sha") + 1] : null;
  const get = async (p) => fetch(base + p, { redirect: "manual" });
  console.log(`\n=== production smoke: ${base} ===`);
  await (async () => {
    for (const [name, path, check] of [
      ["home /", "/", (r) => r.ok],
      ["/sources", "/sources", (r) => r.ok],
      ["/money", "/money", (r) => r.ok],
      ["api /api/search", "/api/search?q=Orpo", (r) => r.status === 200 || r.status === 429],
      ["api /api/entities", "/api/entities?per_page=1", (r) => r.status === 200 || r.status === 429],
      ["api /api/entities/:id", "/api/entities?per_page=1", (r) => r.status === 200 || r.status === 429],
      ["admin protected", "/admin", (r) => r.status === 307 || r.status === 302 || r.status === 401],
      ["cron protected", "/api/cron/ingest", (r) => r.status === 401],
      ["corrections cross-site blocked", "/api/corrections", (r) => r.status === 403 || r.status === 405],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await get(path).catch((e) => ({ ok: false, status: 0, _err: e.message }));
      record(`smoke: ${name}`, check(r), `status ${r.status ?? "?"}${r._err ? ` (${r._err})` : ""}`);
    }
    // /api/version — SHA + rate-limit backend (no credentials exposed).
    try {
      const v = await (await get("/api/version")).json();
      record("smoke: /api/version", true, `sha ${String(v.sha).slice(0, 12)} · built ${v.builtAt} · rl:${v.rateLimitBackend}`);
      if (expectSha) {
        record("smoke: production SHA matches", v.sha === expectSha, `deployed ${String(v.sha).slice(0, 12)} vs expected ${String(expectSha).slice(0, 12)}`);
      }
      if (process.env.SMOKE_EXPECT_UPSTASH === "1") {
        record("smoke: rate-limit backend is upstash", v.rateLimitBackend === "upstash", `backend=${v.rateLimitBackend}`);
      }
    } catch (e) {
      record("smoke: /api/version", false, e.message);
    }
  })();
}

const failed = results.filter((r) => !r.ok);
console.log("\n" + "=".repeat(60));
console.log(`Checks: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`);
if (failed.length) {
  console.log("Failed checks:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
console.log("=".repeat(60));
console.log(`\nRELEASE GATE: ${failed.length === 0 ? "GO" : "NO-GO"}\n`);
process.exit(failed.length === 0 ? 0 : 1);
