import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { hashPassword, signUserSession, createEmailVerificationToken, setUserSessionCookie } from "@/lib/vaikuta/authUser";
import { isSameOriginRequest } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const rl = await rateLimit(req, "auth");
  if (!rl.allowed) return tooManyRequests(rl);

  let body: { email?: string; password?: string } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const existing = await db.vaikutaUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_in_use" }, { status: 409 });
  }

  const user = await db.vaikutaUser.create({
    data: { email, passwordHash: await hashPassword(password) },
  });

  // Prototype email verification: no mail provider is wired up yet, so the
  // verification link is returned to the client and shown on-screen, clearly
  // labelled as simulation. Real mail delivery is a separate future step.
  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = `/vaikuta/auth/verify?token=${encodeURIComponent(token)}`;

  const sessionToken = await signUserSession(user.id);
  const res = NextResponse.json(
    { ok: true, verifyUrl, email, prototypeVerify: true },
    { status: 201 },
  );
  return setUserSessionCookie(res, sessionToken);
}