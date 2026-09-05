/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Deployment identity, baked at build time and exposed by /api/version.
// CLI deploys: vercel deploy --prod --build-env BUILD_SHA=$(git rev-parse HEAD)
const BUILD_SHA = process.env.BUILD_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown";
const BUILD_TIME = new Date().toISOString();

// Content-Security-Policy.
//   script-src:
//     'unsafe-eval' — required only in development (React Fast Refresh /
//     webpack HMR). NOT emitted in production: the app bundle (Next 15,
//     React 19, Cytoscape) runs without eval.
//     'unsafe-inline' — still required in production: the Next.js App Router
//     emits inline bootstrap scripts (self.__next_f...) with no nonce/hash.
//     Removing it needs nonce-based CSP via middleware on every response —
//     a rendering-architecture change tracked as a Sprint A.3 follow-up
//     (see readme "Known follow-ups"). No concrete injection sink exists
//     today (no user HTML is rendered; output is escaped by React).
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])].join(" ");
const CSP = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avoindata.eduskunta.fi",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { BUILD_SHA, BUILD_TIME },
  async headers() {
    // CORS is scoped to the public READ API only. Cross-origin use of the open
    // data endpoints is intentional (see /api docs). Write/auth/admin/cron
    // endpoints get NO CORS headers — same-origin only — and /api/corrections
    // additionally enforces an Origin/Referer check in the route handler.
    const publicReadApi = [
      "/api/search",
      "/api/entities",
      "/api/entities/:path*",
      "/api/money",
      "/api/changes",
    ];
    return [
      ...publicReadApi.map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // HSTS is set by the hosting platform (Vercel) with preload; kept here as defense.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;