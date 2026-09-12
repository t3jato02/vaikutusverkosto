import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { institutionalReviewQueue, reviewInstitutionalFact } from "@/lib/institutionalPower/reviewQueue";

// Admin-only (middleware). Institutional review queue: GET lists candidate
// institutional facts; POST applies a human review action.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimit(req, "expensive");
  if (!rl.allowed) return tooManyRequests(rl);
  const queue = await institutionalReviewQueue();
  return NextResponse.json({ items: queue, count: queue.length });
}

export async function POST(req: Request) {
  const rl = await rateLimit(req, "expensive");
  if (!rl.allowed) return tooManyRequests(rl);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { kind, id, action, note } = (body ?? {}) as { kind?: string; id?: string; action?: string; note?: string };
  if (!["position", "category", "sector"].includes(kind ?? "") || !id || !["approve", "reject", "dispute"].includes(action ?? "")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await reviewInstitutionalFact(kind as "position" | "category" | "sector", id, action as "approve" | "reject" | "dispute", note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}