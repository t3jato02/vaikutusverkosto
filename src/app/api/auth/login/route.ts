import { NextResponse } from "next/server";
import { createSessionToken, safeEqual, setSessionCookie } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rl = await rateLimit(req, "auth");
  if (!rl.allowed) return tooManyRequests(rl);
  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const password = String(body.get("password") ?? "");
  const rawNext = String(body.get("next") ?? "");
  // Only same-origin, relative redirect targets are allowed after login
  // (blocks open-redirect via absolute/protocol-relative URLs).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }
  if (!password || !safeEqual(password, expected)) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }
  const token = await createSessionToken();
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  return setSessionCookie(res, token);
}