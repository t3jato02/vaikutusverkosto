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

// 3. Unit + integration tests (Vitest; includes live DB invariant checks)
step("unit+integration tests", () => {
  const out = sh("npx vitest run --reporter=dot");
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

// 7. Optional: Playwright e2e release gate
if (FULL) {
  step("e2e (Playwright)", () => { sh("npx playwright test", { stdio: ["ignore", "inherit", "inherit"] }); return "e2e passed"; });
}

// 8. Optional: production URL + API smoke
if (SMOKE_URL) {
  const base = SMOKE_URL.replace(/\/+$/, "");
  const get = async (p) => {
    const r = await fetch(base + p, { redirect: "manual" });
    return r;
  };
  console.log(`\n=== production smoke: ${base} ===`);
  await (async () => {
    for (const [name, path, check] of [
      ["home /", "/", (r) => r.ok],
      ["/sources", "/sources", (r) => r.ok],
      ["/money", "/money", (r) => r.ok],
      ["api /api/search", "/api/search?q=Orpo", (r) => r.status === 200 || r.status === 429],
      ["api /api/entities", "/api/entities?per_page=1", (r) => r.status === 200 || r.status === 429],
      ["admin protected", "/admin", (r) => r.status === 307 || r.status === 302 || r.status === 401],
      ["cron protected", "/api/cron/ingest", (r) => r.status === 401],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await get(path).catch((e) => ({ ok: false, status: 0, _err: e.message }));
      const ok = check(r);
      record(`smoke: ${name}`, ok, `status ${r.status ?? "?"}${r._err ? ` (${r._err})` : ""}`);
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
