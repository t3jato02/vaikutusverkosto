// Single source of truth for the public production origin.
// canonical / OpenGraph / Twitter / sitemap / robots / structured data /
// person + organization + decision pages all resolve their base URL here.
//
// Production has no placeholder-domain fallback (A3): PUBLIC_BASE_URL is
// required in production and validated by src/lib/env.ts. In development we
// fall back to the local dev origin only.

const DEV_FALLBACK = "http://localhost:3000";

/** Canonical public origin, no trailing slash. */
export function baseUrl(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  // `next build` evaluates route modules for static metadata; that is not
  // server startup, so do not hard-fail the build for a missing runtime value.
  if (process.env.NEXT_PHASE === "phase-production-build") return DEV_FALLBACK;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PUBLIC_BASE_URL is required in production (canonical/OG/sitemap/robots).",
    );
  }
  return DEV_FALLBACK;
}

/** Absolute URL for a site-relative path (path must start with "/"). */
export function absoluteUrl(path: string): string {
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
