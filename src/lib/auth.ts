// Server-side admin authentication.
// Session = httpOnly signed JWT cookie (jose, HS256) with role claim.
// All /admin* and /api/admin* + /api/cron* access must pass requireAdminSession.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "vk_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 h

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    // Fail fast in production; dev-only fallback is explicit and local.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to a secure random string in production.");
    }
    return new TextEncoder().encode("dev-only-insecure-auth-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

/** Shared HS256 signing key for admin and citizen sessions (jose). */
export function signingKey(): Uint8Array {
  return secretKey();
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<{ role: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "admin") return null;
    return { role: "admin" };
  } catch {
    return null;
  }
}

export async function getSessionFromCookie(): Promise<{ role: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Timing-safe password comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Set the admin session cookie on a response. */
export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/** For server component pages: returns true if a valid admin session exists. */
export async function isAdminSession(): Promise<boolean> {
  return (await getSessionFromCookie()) !== null;
}