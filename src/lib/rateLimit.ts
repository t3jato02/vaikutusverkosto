// Minimal in-memory fixed-window rate limiter for the public API.
// Production: replace with a distributed store (e.g. Redis) behind a reverse proxy.

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return { allowed: false, retryAfterMs: b.resetAt - now };
  }
  // opportunistic cleanup
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}