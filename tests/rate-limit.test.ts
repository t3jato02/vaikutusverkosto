import { describe, it, expect, beforeEach } from "vitest";
import "dotenv/config";
import {
  rateLimit,
  clientIp,
  rateLimitBackend,
  failurePolicy,
  purposeLimit,
  __resetMemoryBuckets,
} from "@/lib/rateLimit";

function reqFrom(ip: string, url = "http://localhost/api/x"): Request {
  return new Request(url, { headers: { "x-forwarded-for": ip } });
}

beforeEach(() => __resetMemoryBuckets());

describe("rate limiter (centralised)", () => {
  it("uses the in-memory backend when Upstash env is absent (dev/test fallback)", () => {
    expect(rateLimitBackend()).toBe("memory");
  });

  it("allows requests below the threshold", async () => {
    const r = await rateLimit(reqFrom("1.1.1.1"), "public_read");
    expect(r.allowed).toBe(true);
    expect(r.retryAfterMs).toBe(0);
  });

  it("returns 429 semantics once the threshold is exceeded", async () => {
    const limit = purposeLimit("corrections"); // 10
    const ip = "2.2.2.2";
    for (let i = 0; i < limit; i++) {
      const r = await rateLimit(reqFrom(ip), "corrections");
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(reqFrom(ip), "corrections");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps independent counters per identifier", async () => {
    const limit = purposeLimit("corrections");
    for (let i = 0; i < limit; i++) await rateLimit(reqFrom("3.3.3.3"), "corrections");
    const other = await rateLimit(reqFrom("4.4.4.4"), "corrections");
    expect(other.allowed).toBe(true);
  });

  it("keeps separate buckets per purpose for the same identifier", async () => {
    const ip = "5.5.5.5";
    const limit = purposeLimit("corrections");
    for (let i = 0; i < limit; i++) await rateLimit(reqFrom(ip), "corrections");
    const blockedWrite = await rateLimit(reqFrom(ip), "corrections");
    expect(blockedWrite.allowed).toBe(false);
    // Same IP, different purpose — must not be affected.
    const read = await rateLimit(reqFrom(ip), "public_read");
    expect(read.allowed).toBe(true);
  });

  it("defines a fail-open policy for public reads and fail-closed for sensitive purposes", () => {
    expect(failurePolicy("public_read")).toBe("allow");
    expect(failurePolicy("corrections")).toBe("deny");
    expect(failurePolicy("auth")).toBe("deny");
    expect(failurePolicy("expensive")).toBe("deny");
  });

  it("normalises the client identifier from x-forwarded-for", () => {
    expect(clientIp(reqFrom(" 9.9.9.9 , 10.0.0.1"))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://localhost/x"))).toBe("local");
  });
});
