import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { getCurrentUser, createEmailVerificationToken } from "@/lib/vaikuta/authUser";
import { isSameOriginRequest } from "@/lib/site";

// Prototype email re-send: no mail provider exists, so a fresh verification
// link is returned for display. Idempotent-ish: previous tokens stay valid.
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const rl = await rateLimit(req, "auth");
  if (!rl.allowed) return tooManyRequests(rl);

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ error: "already_verified" }, { status: 409 });

  const token = await createEmailVerificationToken(user.id);
  return NextResponse.json({ ok: true, verifyUrl: `/vaikuta/auth/verify?token=${encodeURIComponent(token)}` });
}