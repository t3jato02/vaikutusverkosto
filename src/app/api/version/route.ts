import { NextResponse } from "next/server";
import { rateLimitBackend } from "@/lib/rateLimit";

// Deployment identity + runtime backend report. No secrets.
// BUILD_SHA / BUILD_TIME are baked at build time (next.config.js). For CLI
// deploys pass --build-env BUILD_SHA=$(git rev-parse HEAD).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    sha: process.env.BUILD_SHA ?? "unknown",
    builtAt: process.env.BUILD_TIME ?? null,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    rateLimitBackend: rateLimitBackend(),
  });
}
