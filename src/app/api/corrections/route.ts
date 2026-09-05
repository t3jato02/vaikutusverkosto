import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveShortId } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { isSameOriginRequest } from "@/lib/site";

// Public, unauthenticated write endpoint. Defences (Phase 6):
//  - same-origin only (Origin/Referer check; no cross-site submissions)
//  - distributed rate limit (corrections bucket, fail-closed)
//  - body-size cap
//  - strict field validation + category allow-list
//  - honeypot field for trivial bot spam
// No CSRF token: the endpoint has no session/cookie to ride, so a token would
// add ceremony without security. The origin check is the meaningful control.

const MAX_BODY_BYTES = 8 * 1024;
const MAX_DESCRIPTION = 4000;
const MAX_EMAIL = 254;
const MAX_URL = 500;

const CATEGORIES = new Set([
  "incorrect_person",
  "wrong_relationship",
  "outdated_role",
  "incorrect_amount",
  "missing_source",
  "identity_collision",
  "other",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const rl = await rateLimit(req, "corrections");
  if (!rl.allowed) return tooManyRequests(rl);

  const lenHeader = Number(req.headers.get("content-length") ?? 0);
  if (lenHeader && lenHeader > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  // Honeypot: a hidden field real users never fill.
  if (String(form.get("website") ?? "").trim() !== "") {
    // Pretend success — don't tell the bot.
    return NextResponse.redirect(new URL("/corrections?sent=1", req.url), 303);
  }

  const entityUrl = String(form.get("entityUrl") ?? "").trim().slice(0, MAX_URL);
  const category = String(form.get("category") ?? "other").trim();
  const description = String(form.get("description") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!description || description.length < 10) {
    return NextResponse.json({ error: "description_too_short" }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "description_too_long" }, { status: 400 });
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!entityUrl) {
    return NextResponse.json({ error: "missing_entity_url" }, { status: 400 });
  }

  // Optionally link to an existing entity (resolve from /person/...-id url).
  const m = entityUrl.match(/-([0-9a-f]{8})(?:[/?#]|$)/);
  let entityId: string | undefined;
  if (m) {
    const full = await resolveShortId(m[1]);
    if (full) entityId = full;
  }

  await db.correction.create({
    data: {
      entityId,
      reporterEmail: email || null,
      category,
      description,
      status: "SUBMITTED",
    },
  });

  return NextResponse.redirect(new URL("/corrections?sent=1", req.url), 303);
}
