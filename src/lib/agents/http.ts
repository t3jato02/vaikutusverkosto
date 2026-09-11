// HTTP helpers for public-data ingestion with retries and concurrency.
//
// Encoding policy (see also src/lib/ingestion/fetch.ts):
//   JSON is UTF-8 by contract (RFC 8259 §8.1 — "JSON text exchanged between
//   systems that are not part of a closed ecosystem MUST be encoded using
//   UTF-8"). We therefore decode responses as UTF-8 UNLESS the server
//   explicitly declares a different charset in its Content-Type header. This
//   replaced an earlier hard-coded ISO-8859-1 decode that silently corrupted
//   every Finnish character coming from avoindata.eduskunta.fi (which serves
//   UTF-8): "Työelämä" -> "TyÃ¶elÃ¤mÃ¤". Do not reintroduce a blind Latin-1
//   decode.

export class TransientError extends Error {}

// SSRF guard for every agent fetch (section 32). Agents fetch hard-coded
// public-data URLs, but the guard stays defensive: loopback, private,
// link-local, CGNAT and cloud-metadata hosts are always rejected.
import { assertPublicHttpUrl } from "@/lib/ssrf";
export { assertPublicHttpUrl };

/** Map a Content-Type charset token to a TextDecoder label. */
function charsetFromContentType(contentType: string | null): string {
  const m = /charset\s*=\s*"?([\w-]+)"?/i.exec(contentType ?? "");
  const raw = (m?.[1] ?? "").toLowerCase();
  if (!raw) return "utf-8";
  if (raw === "latin1" || raw === "latin-1" || raw === "iso8859-1") return "iso-8859-1";
  if (raw === "cp1252") return "windows-1252";
  return raw; // "utf-8", "iso-8859-1", "windows-1252", ...
}

/** Decode a response body honoring its declared charset, defaulting to UTF-8. */
async function decodeResponse(res: Response): Promise<string> {
  const label = charsetFromContentType(res.headers.get("content-type"));
  if (label === "utf-8" || label === "utf8") {
    // Fast path — fetch already decodes UTF-8 correctly.
    return res.text();
  }
  const buf = await res.arrayBuffer();
  try {
    return new TextDecoder(label, { fatal: false }).decode(buf);
  } catch {
    // Unknown label — fall back to UTF-8 rather than corrupting the payload.
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }
}

async function fetchWithRetry(
  url: string,
  opts: { timeoutMs: number; maxRetries: number; headers: Record<string, string> },
): Promise<Response> {
  assertPublicHttpUrl(url); // SSRF guard (section 32)
  const { timeoutMs, maxRetries, headers } = opts;
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", ...headers },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new TransientError(`HTTP ${res.status} for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      const transient = e instanceof TransientError || (e instanceof Error && e.name === "AbortError");
      if (transient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 500);
        await sleep(delay);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

interface FetchOpts {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch JSON, decoding the body per the server's declared charset (default
 * UTF-8). Use this for every ingestion source — including Eduskunta, which
 * serves UTF-8.
 */
export async function fetchJsonRetry<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { timeoutMs = 30_000, maxRetries = 3, headers = {} } = opts;
  const res = await fetchWithRetry(url, { timeoutMs, maxRetries, headers });
  const text = await decodeResponse(res);
  return JSON.parse(text) as T;
}

/** Fetch JSON that is genuinely UTF-8 encoded (standard JSON). Kept as an
 *  explicit-intent alias; behaves identically to {@link fetchJsonRetry}. */
export async function fetchJsonUtf8Retry<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { timeoutMs = 30_000, maxRetries = 3, headers = {} } = opts;
  const res = await fetchWithRetry(url, { timeoutMs, maxRetries, headers });
  return (await res.json()) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}
