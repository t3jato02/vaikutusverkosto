import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { verifyPassword, signUserSession, setUserSessionCookie } from "@/lib/vaikuta/authUser";
import { db } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/site";

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
  if (!email || !password) return NextResponse.json({ error: "credentials_required" }, { status: 400 });

  const user = await db.vaikutaUser.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  }

  const token = await signUserSession(user.id);
  const res = NextResponse.json({ ok: true });
  return setUserSessionCookie(res, token);
}