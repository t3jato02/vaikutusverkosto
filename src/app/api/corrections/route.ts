import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveShortId } from "@/lib/queries";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rl = await rateLimit(req, "corrections");
  if (!rl.allowed) return tooManyRequests(rl);
  let body: Record<string, unknown>;
  try {
    body = Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const entityUrl = String(body.entityUrl ?? "");
  const category = String(body.category ?? "other");
  const description = String(body.description ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!description || !entityUrl) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
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