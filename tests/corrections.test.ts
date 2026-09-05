import { describe, it, expect, beforeEach } from "vitest";
import "dotenv/config";
import { POST } from "@/app/api/corrections/route";
import { isSameOriginRequest } from "@/lib/site";
import { __resetMemoryBuckets } from "@/lib/rateLimit";

const ORIGIN = "http://localhost:3000";

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function post(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/corrections`, {
    method: "POST",
    headers: { origin: ORIGIN, ...headers },
    body: form(fields),
  });
}

beforeEach(() => __resetMemoryBuckets());

describe("isSameOriginRequest", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOriginRequest(new Request(`${ORIGIN}/x`, { headers: { origin: ORIGIN } }))).toBe(true);
  });
  it("falls back to Referer", () => {
    expect(isSameOriginRequest(new Request(`${ORIGIN}/x`, { headers: { referer: `${ORIGIN}/corrections` } }))).toBe(true);
  });
  it("rejects a foreign Origin", () => {
    expect(isSameOriginRequest(new Request(`${ORIGIN}/x`, { headers: { origin: "https://evil.example" } }))).toBe(false);
  });
  it("rejects a request with neither Origin nor Referer", () => {
    expect(isSameOriginRequest(new Request(`${ORIGIN}/x`))).toBe(false);
  });
});

describe("POST /api/corrections hardening", () => {
  const valid = { entityUrl: "/person/x-12345678", category: "wrong_relationship", description: "This is clearly wrong because the source says otherwise." };

  it("403s a cross-site submission", async () => {
    const res = await POST(post(valid, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("403s when no Origin/Referer is present", async () => {
    const req = new Request(`${ORIGIN}/api/corrections`, { method: "POST", body: form(valid) });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects an unknown category", async () => {
    const res = await POST(post({ ...valid, category: "totally_made_up" }));
    expect(res.status).toBe(400);
  });

  it("rejects a too-short description", async () => {
    const res = await POST(post({ ...valid, description: "bad" }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed email", async () => {
    const res = await POST(post({ ...valid, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("silently accepts (fake-success 303) when the honeypot is filled", async () => {
    const res = await POST(post({ ...valid, website: "http://spam.example" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/corrections?sent=1");
  });

  it.skipIf(!process.env.DATABASE_URL)("accepts a valid same-origin submission", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("sent=1");
  });
});
