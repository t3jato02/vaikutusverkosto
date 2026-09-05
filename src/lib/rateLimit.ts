// Centralised rate limiting for every route. Routes never construct their own
// limiter — they call `rateLimit(req, purpose)` and honour the result.
//
// Backend:
//   - Upstash Redis (@upstash/ratelimit, sliding window) when
//     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are both set. Shared
//     state across all serverless instances.
//   - In-memory fixed-window fallback otherwise (development, tests, and a
//     controlled degradation for public reads if Redis is unreachable).
//
// Failure policy (Redis error / timeout):
//   - public_read : fail-OPEN  — a limiter outage must not take the site down.
//   - corrections : fail-CLOSED — public write endpoint, protect it.
//   - auth        : fail-CLOSED — never let brute-force become unlimited.
//   - expensive   : fail-CLOSED — protects cost-bearing work.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitPurpose = "public_read" | "corrections" | "auth" | "expensive";

interface PurposeConfig {
  /** Requests allowed per window, per identifier. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** What to do when the backend itself fails. */
  onBackendError: "allow" | "deny";
}

const SEARCH_LIMIT = Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 120) || 120;

const PURPOSES: Record<RateLimitPurpose, PurposeConfig> = {
  public_read: { limit: SEARCH_LIMIT, windowSeconds: 60, onBackendError: "allow" },
  corrections: { limit: 10, windowSeconds: 60, onBackendError: "deny" },
  auth: { limit: 10, windowSeconds: 60, onBackendError: "deny" },
  expensive: { limit: 20, windowSeconds: 60, onBackendError: "deny" },
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  backend: "upstash" | "memory";
}

// ---------------------------------------------------------------- identifier

/** Normalised client IP — the only thing we key on. No other PII. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const raw = xff ? xff.split(",")[0] : (req.headers.get("x-real-ip") ?? "local");
  return raw.trim().toLowerCase() || "local";
}

// ---------------------------------------------------------------- backend detect

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
  throw new Error(
    "Upstash rate limiting is half-configured: set BOTH UPSTASH_REDIS_REST_URL and " +
      "UPSTASH_REDIS_REST_TOKEN, or neither.",
  );
}

const useUpstash = Boolean(upstashUrl && upstashToken);

/** Backend currently in effect — for health/version reporting (no credentials). */
export function rateLimitBackend(): "upstash" | "memory" {
  return useUpstash ? "upstash" : "memory";
}

/** The fail-open / fail-closed policy applied when the backend errors. */
export function failurePolicy(purpose: RateLimitPurpose): "allow" | "deny" {
  return PURPOSES[purpose].onBackendError;
}

/** Configured limit for a purpose (per window). */
export function purposeLimit(purpose: RateLimitPurpose): number {
  return PURPOSES[purpose].limit;
}

let redis: Redis | null = null;
const upstashLimiters = new Map<RateLimitPurpose, Ratelimit>();

function getUpstashLimiter(purpose: RateLimitPurpose): Ratelimit {
  if (!redis) redis = new Redis({ url: upstashUrl!, token: upstashToken! });
  let l = upstashLimiters.get(purpose);
  if (!l) {
    const cfg = PURPOSES[purpose];
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.windowSeconds} s`),
      prefix: `vk:rl:${purpose}`,
      analytics: false,
    });
    upstashLimiters.set(purpose, l);
  }
  return l;
}

// ---------------------------------------------------------------- memory fallback

const WINDOW_BUCKETS = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, cfg: PurposeConfig): RateLimitResult {
  const now = Date.now();
  let b = WINDOW_BUCKETS.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + cfg.windowSeconds * 1000 };
    WINDOW_BUCKETS.set(key, b);
  }
  b.count += 1;
  if (WINDOW_BUCKETS.size > 10_000) {
    for (const [k, v] of WINDOW_BUCKETS) if (v.resetAt <= now) WINDOW_BUCKETS.delete(k);
  }
  if (b.count > cfg.limit) return { allowed: false, retryAfterMs: b.resetAt - now, backend: "memory" };
  return { allowed: true, retryAfterMs: 0, backend: "memory" };
}

/** Test-only: clear the in-memory window state. */
export function __resetMemoryBuckets() {
  WINDOW_BUCKETS.clear();
}

// ---------------------------------------------------------------- public API

// Opt-out for end-to-end runs only: the e2e suite issues bursts from a single
// IP and would otherwise poison the shared window for unrelated tests. Never
// honoured unless explicitly set; unit tests cover the limiter directly.
const DISABLED = process.env.RATE_LIMIT_DISABLED === "1";

export async function rateLimit(req: Request, purpose: RateLimitPurpose): Promise<RateLimitResult> {
  const cfg = PURPOSES[purpose];
  const id = `${purpose}:${clientIp(req)}`;

  if (DISABLED) return { allowed: true, retryAfterMs: 0, backend: "memory" };
  if (!useUpstash) return memoryLimit(id, cfg);

  try {
    const r = await getUpstashLimiter(purpose).limit(id);
    return {
      allowed: r.success,
      retryAfterMs: r.success ? 0 : Math.max(0, r.reset - Date.now()),
      backend: "upstash",
    };
  } catch {
    // Backend outage — apply the per-purpose policy.
    if (cfg.onBackendError === "allow") return { allowed: true, retryAfterMs: 0, backend: "memory" };
    return { allowed: false, retryAfterMs: cfg.windowSeconds * 1000, backend: "memory" };
  }
}

/** Standard 429 body + Retry-After header for a blocked request. */
export function tooManyRequests(result: RateLimitResult) {
  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } },
  );
}
