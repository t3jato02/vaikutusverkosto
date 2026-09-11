import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { consumeEmailVerificationToken } from "@/lib/vaikuta/authUser";
import { isSameOriginRequest } from "@/lib/site";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const rl = await rateLimit(req, "auth");
  if (!rl.allowed) return tooManyRequests(rl);

  let body: { token?: string } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });

  return NextResponse.json({ ok: true, verified: true });
}