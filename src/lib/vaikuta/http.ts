// Shared HTTP helpers for VAIKUTA API routes.
// Authenticated JSON endpoints: same-origin check + JSON content type
// (blocks simple cross-site form posts), rate limiting, body cap.

import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/site";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/vaikuta/authUser";
import { isEmailVerified } from "@/lib/vaikuta/authUser";

const MAX_BODY_BYTES = 128 * 1024;

export function apiError(status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export interface AuthedRequest<T> {
  userId: string;
  email: string;
  emailVerified: boolean;
  body: T | null;
}

/** Authenticate + parse a JSON request. Returns discriminated result. */
export async function authedJson<T>(req: Request): Promise<{ ok: true; ctx: AuthedRequest<T> } | { ok: false; res: Response }> {
  if (!isSameOriginRequest(req)) {
    return { ok: false, res: apiError(403, "forbidden_origin") };
  }
  const rl = await rateLimit(req, "expensive");
  if (!rl.allowed) return { ok: false, res: tooManyRequests(rl) };

  const lenHeader = Number(req.headers.get("content-length") ?? 0);
  if (lenHeader && lenHeader > MAX_BODY_BYTES) {
    return { ok: false, res: apiError(413, "payload_too_large") };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, res: apiError(401, "unauthorized") };

  const ctype = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (ctype !== "application/json") {
    return { ok: false, res: apiError(415, "unsupported_media_type") };
  }

  let body: T | null = null;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return { ok: false, res: apiError(413, "payload_too_large") };
    if (raw.trim()) body = JSON.parse(raw) as T;
  } catch {
    return { ok: false, res: apiError(400, "invalid_json") };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      email: user.email,
      emailVerified: isEmailVerified(user),
      body,
    },
  };
}

/** Authenticate a GET (no body). For read-only authorized endpoints. */
export async function authedGet(req: Request): Promise<{ ok: true; ctx: AuthedRequest<null> } | { ok: false; res: Response }> {
  if (!isSameOriginRequest(req)) return { ok: false, res: apiError(403, "forbidden_origin") };
  const rl = await rateLimit(req, "public_read");
  if (!rl.allowed) return { ok: false, res: tooManyRequests(rl) };
  const user = await getCurrentUser();
  if (!user) return { ok: false, res: apiError(401, "unauthorized") };
  return {
    ok: true,
    ctx: { userId: user.id, email: user.email, emailVerified: isEmailVerified(user), body: null },
  };
}

export { isEmailVerified } from "@/lib/vaikuta/authUser";