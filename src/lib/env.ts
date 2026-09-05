// Environment validation — fail fast in production when required config is missing.
// Never silently fall back to localhost/demo credentials in production.

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "PUBLIC_BASE_URL",
];

export function validateEnv(): { ok: boolean; missing: string[] } {
  if (!isProduction()) return { ok: true, missing: [] };
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k] || process.env[k]!.length < 8);
  return { ok: missing.length === 0, missing };
}

// During `next build`, page data collection loads route modules. That is not
// server startup, so we do not fail the build for missing runtime secrets.
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Paired optional vars: set both or neither. */
const PAIRED_OPTIONAL: [string, string][] = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
];

// Called once from the DB client module so the server fails fast.
export function assertEnvValid() {
  if (isBuildPhase()) return;
  const { ok, missing } = validateEnv();
  if (!ok) {
    throw new Error(
      `Production environment is missing required configuration: ${missing.join(", ")}. ` +
        "Set these environment variables before starting the server.",
    );
  }
  for (const [a, b] of PAIRED_OPTIONAL) {
    if (Boolean(process.env[a]?.trim()) !== Boolean(process.env[b]?.trim())) {
      throw new Error(`Env ${a} and ${b} must be set together, or neither.`);
    }
  }
  if (isProduction() && !process.env.UPSTASH_REDIS_REST_URL) {
    console.warn(
      "[env] UPSTASH_REDIS_REST_URL not set — rate limiting is per-instance " +
        "in-memory. Provision Upstash Redis for a shared distributed limit.",
    );
  }
}