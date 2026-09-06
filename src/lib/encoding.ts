// UTF-8 integrity helpers.
//
// The ingestion layer decodes every source as UTF-8 (see src/lib/agents/http.ts).
// These helpers detect and deterministically reverse the one corruption that
// already reached the database: UTF-8 bytes that were decoded as ISO-8859-1
// (mojibake) - e.g. a string whose Finnish diacritics render as "A-tilde"
// pairs. They are pure and are used by the one-off repair
// (scripts/fix-mojibake.mjs), its regression tests, and as a defensive net at
// ingestion boundaries.

// Signature a UTF-8 sequence leaves behind when decoded as Latin-1 / CP1252:
//   U+00C3 / U+00C2 lead  +  a U+0080..U+00FF continuation, or
//   U+00E2 U+20AC ("a-hat euro") + a smart-punctuation artifact.
// Kept as \u escapes so this source file stays pure ASCII.
const MOJIBAKE_SIGNATURE = /[ÃÂ][-ÿ]|â€[-ÿ–—‘-„…™]?/;

/** True if `s` looks like it contains UTF-8 to Latin-1 mojibake. */
export function hasMojibake(s: string): boolean {
  return MOJIBAKE_SIGNATURE.test(s);
}

/** Repair a run whose characters are all representable as single Latin-1 bytes. */
function repairRun(run: string): string | null {
  if (!hasMojibake(run)) return null;
  let decoded = Buffer.from(run, "latin1").toString("utf8");
  if (decoded.includes("�")) return null; // invalid UTF-8 sequence
  if (Buffer.from(decoded, "utf8").toString("latin1") !== run) return null; // not a true inverse
  if (decoded === run) return null;
  if (hasMojibake(decoded)) {
    // Double-encoded - apply the inverse once more under the same guards.
    if ([...decoded].some((ch) => ch.codePointAt(0)! > 0xff)) return null;
    const twice = Buffer.from(decoded, "latin1").toString("utf8");
    if (twice.includes("�")) return null;
    if (Buffer.from(twice, "utf8").toString("latin1") !== decoded) return null;
    if (hasMojibake(twice)) return null;
    decoded = twice;
  }
  return decoded;
}

/**
 * Deterministically reverse UTF-8 to Latin-1 mojibake in `s`.
 *
 * Works run-by-run: characters above U+00FF (e.g. a correctly stored em dash)
 * cannot be part of a Latin-1 mojibake sequence, so they are preserved
 * verbatim and split the string into independently repairable runs. A run is
 * only rewritten when the Latin-1 to UTF-8 transform is a proven lossless
 * inverse and the result carries no mojibake signature. Returns the input
 * unchanged when no safe repair applies.
 */
export function repairMojibake(s: string): string {
  if (!hasMojibake(s)) return s;
  let out = "";
  let run = "";
  let changed = false;
  const flush = () => {
    if (run === "") return;
    const fixed = repairRun(run);
    if (fixed === null) {
      out += run;
    } else {
      out += fixed;
      changed = true;
    }
    run = "";
  };
  for (const ch of s) {
    if (ch.codePointAt(0)! > 0xff) {
      flush();
      out += ch;
    } else {
      run += ch;
    }
  }
  flush();
  if (!changed || hasMojibake(out)) return s;
  return out;
}
