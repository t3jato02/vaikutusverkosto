// Middleware: protect admin pages, admin API routes and cron routes.
// - /admin*  → valid admin session required, else redirect to /login
// - /api/admin* → valid admin session required, else 401
// - /api/cron* → valid admin session OR CRON_SECRET bearer, else 401
// Public API and public pages are untouched.

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const ADMIN_PAGE_RE = /^\/admin(?:\/|$)/;
const ADMIN_API_RE = /^\/api\/admin(?:\/|$)/;
const CRON_API_RE = /^\/api\/cron(?:\/|$)/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!ADMIN_PAGE_RE.test(pathname) && !ADMIN_API_RE.test(pathname) && !CRON_API_RE.test(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (CRON_API_RE.test(pathname) && !session) {
    // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && bearer && safeEqualCron(cronSecret, bearer)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session) {
    if (ADMIN_PAGE_RE.test(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

function safeEqualCron(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/cron/:path*"],
};