// Canonical content hashing for change detection.
// The same *meaningful* content must always produce the same hash, so that an
// unchanged document never re-triggers the expensive parse/resolve/LLM chain.

import { createHash } from "node:crypto";

/** Recursively sort object keys so key order never affects the hash. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Collapse insignificant whitespace in text payloads. */
function canonicalText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function hashText(text: string): string {
  return createHash("sha256").update(canonicalText(text)).digest("hex");
}

/** Hash any collected payload. */
export function contentHash(payload: { json?: unknown; text?: string }): string {
  if (payload.json !== undefined) return hashJson(payload.json);
  return hashText(payload.text ?? "");
}
