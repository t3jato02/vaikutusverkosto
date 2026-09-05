// Guarded HTTP fetch for ingestion: SSRF-safe, retrying, timing-instrumented.
// Adapters never fetch user-controlled URLs — but this stays defensive anyway.

import type { CollectedPayload } from "./types";

export class TransientHttpError extends Error {}

const BLOCKED_HOST_RE =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|::1$|\[::1\]$|172\.(1[6-9]|2\d|3[01])\.)/i;

function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`invalid URL: ${raw}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`blocked URL scheme: ${u.protocol}`);
  }
  if (BLOCKED_HOST_RE.test(u.hostname)) {
    throw new Error(`blocked non-public host: ${u.hostname}`);
  }
  return u;
}

export interface FetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** "json" (default) | "text" | "latin1" (ISO-8859-1 JSON, e.g. Eduskunta). */
  decode?: "json" | "text" | "latin1";
}

export async function guardedFetch(url: string, opts: FetchOptions = {}): Promise<CollectedPayload> {
  const { method = "GET", headers = {}, body, timeoutMs = 30_000, maxRetries = 3, decode = "json" } = opts;
  assertPublicHttpUrl(url);

  let attempt = 0;
  for (;;) {
    const started = Date.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { Accept: decode === "text" ? "*/*" : "application/json", ...headers },
        body,
        signal: controller.signal,
        redirect: "follow",
      });
      const ms = Date.now() - started;
      if (res.status === 429 || res.status >= 500) {
        throw new TransientHttpError(`HTTP ${res.status} for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const http = { status: res.status, url, ms };
      const mimeType = res.headers.get("content-type");

      if (decode === "text") {
        return { text: await res.text(), mimeType, http };
      }
      if (decode === "latin1") {
        const buf = await res.arrayBuffer();
        const text = new TextDecoder("iso-8859-1").decode(buf);
        return { json: JSON.parse(text), mimeType, http };
      }
      return { json: await res.json(), mimeType, http };
    } catch (e) {
      const transient =
        e instanceof TransientHttpError || (e instanceof Error && e.name === "AbortError");
      if (transient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}
