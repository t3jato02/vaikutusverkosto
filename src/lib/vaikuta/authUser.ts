// VAIKUTA citizen authentication + identity.
//
// Identity levels for campaign execution:
//   - unverified  → may browse, draft, but cannot execute a campaign
//   - email_verified → default level required for the prototype
//   - strong / organization_verified → future levels (reserved)
//
// Passwords are hashed with Node's scrypt (salt + timing-safe compare). No
// plaintext, no session secrets in the client. Sessions are HS256 JWTs signed
// with the same AUTH_SECRET as the admin session (see src/lib/auth.ts).

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { signingKey } from "@/lib/auth";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const USER_SESSION_COOKIE = "vk_vaikuta_session";
export const USER_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const VERIFY_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 h

// ---------------------------------------------------------------- password hashing

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen);
  const out = Buffer.concat([salt, hash]);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${out.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const raw = Buffer.from(parts[4], "base64");
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const salt = raw.subarray(0, 16);
  const expected = raw.subarray(16);
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------- sessions

export async function signUserSession(userId: string): Promise<string> {
  return new SignJWT({ role: "citizen" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${USER_SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export async function verifyUserSession(
  token: string | undefined | null,
): Promise<{ sub: string; role: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    if (payload.role !== "citizen" || !payload.sub) return null;
    return { sub: payload.sub, role: "citizen" };
  } catch {
    return null;
  }
}

/** Set the citizen session cookie from an API route. */
export function setUserSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set({
    name: USER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export function clearUserSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set({ name: USER_SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

// ---------------------------------------------------------------- user helpers

export async function getCurrentUser() {
  const store = await cookies();
  const session = await verifyUserSession(store.get(USER_SESSION_COOKIE)?.value);
  if (!session) return null;
  return db.vaikutaUser.findUnique({ where: { id: session.sub } });
}

export function isEmailVerified(user: { emailVerifiedAt: Date | null }): boolean {
  return user.emailVerifiedAt !== null;
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.vaikutaVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      purpose: "email_verification",
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const row = await db.vaikutaVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.$transaction([
    db.vaikutaVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.vaikutaUser.update({
      where: { id: row.userId },
      data: {
        emailVerifiedAt: new Date(),
        identityLevel: "email_verified",
      },
    }),
  ]);
  return row.userId;
}