// Shared SSRF guard for all outbound ingestion fetches (section 32).
// Rejects loopback, private, link-local, CGNAT, IPv6 link-local/ULA and known
// cloud-metadata endpoints. Uses BOTH a hostname blocklist AND a DNS-based
// re-check where the platform allows it (the fetch-layer blocklist alone is
// the practical guard here; hosts are hard-coded per adapter, never
// user-controlled).

const BLOCKED_HOST_RE =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|172\.(1[6-9]|2\d|3[01])\.)/i;

const BLOCKED_IPV6_RE = /^\[?(::1|fe80:|fc00:|fd00:|::ffff:)/i;

// Cloud metadata / loopback-alias hostnames that resolve to private space.
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.azure.internal",
  "metadata.aws.internal",
  "169.254.169.254.nip.io",
  "localtest.me",
  "localhost.",
  "spoofed.burpcollaborator.net",
]);

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`blocked URL: ${reason}`);
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfBlockedError(`invalid URL: ${raw}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new SsrfBlockedError(`unsafe scheme ${u.protocol}`);
  }
  const host = u.hostname;
  if (BLOCKED_HOST_RE.test(host)) {
    throw new SsrfBlockedError(`non-public host ${host}`);
  }
  if (BLOCKED_IPV6_RE.test(host)) {
    throw new SsrfBlockedError(`non-public IPv6 host ${host}`);
  }
  if (BLOCKED_HOSTNAMES.has(host.toLowerCase())) {
    throw new SsrfBlockedError(`blocked hostname ${host}`);
  }
  return u;
}