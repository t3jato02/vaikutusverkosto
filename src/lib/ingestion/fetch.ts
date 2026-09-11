// Guarded HTTP fetch for ingestion: SSRF-safe, retrying, timing-instrumented.
// Adapters never fetch user-controlled URLs — but this stays defensive anyway.

import type { CollectedPayload } from "./types";
import { assertPublicHttpUrl } from "@/lib/ssrf";

export class TransientHttpError extends Error {}

export { assertPublicHttpUrl };

export interface FetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /**
   * "json" (default) — decode honoring the response Content-Type charset,
   *   defaulting to UTF-8 (correct for all known sources, incl. Eduskunta).
   * "text" — raw text.
   * "latin1" — force ISO-8859-1 decode. Only for a source PROVEN to serve
   *   Latin-1; a blind Latin-1 decode of UTF-8 JSON corrupts every non-ASCII
   *   character. No current adapter needs this.
   */
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
      // Default: honor the declared charset, default UTF-8. `res.json()` already
      // decodes UTF-8; only re-decode when a non-UTF-8 charset is declared.
      const cs = /charset\s*=\s*"?([\w-]+)"?/i.exec(mimeType ?? "")?.[1]?.toLowerCase();
      if (cs && cs !== "utf-8" && cs !== "utf8") {
        const buf = await res.arrayBuffer();
        const label = cs === "latin1" || cs === "iso8859-1" ? "iso-8859-1" : cs;
        return { json: JSON.parse(new TextDecoder(label, { fatal: false }).decode(buf)), mimeType, http };
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
