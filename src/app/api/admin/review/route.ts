import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import {
  reviewRelationship,
  reviewResolutionCandidate,
  reviewCorrection,
  promoteCandidate,
  rejectCandidate,
  type RelationshipReviewAction,
  type CandidateReviewAction,
} from "@/lib/review";

// Admin-only (middleware). One endpoint for every review action; form posts
// from /admin/review land here and redirect back.
export async function POST(req: Request) {
  const rl = await rateLimit(req, "expensive");
  if (!rl.allowed) return tooManyRequests(rl);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const target = String(form.get("target") ?? "");
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  const note = String(form.get("note") ?? "").trim() || undefined;
  const entityId = String(form.get("entityId") ?? "").trim() || undefined;

  if (!id || !action) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  let result: { ok: true } | { ok: false; error: string };
  if (target === "relationship") {
    if (!["approve", "reject", "dispute", "stale"].includes(action)) {
      return NextResponse.json({ error: "bad_action" }, { status: 400 });
    }
    result = await reviewRelationship(id, action as RelationshipReviewAction, note);
  } else if (target === "candidate") {
    if (!["resolve", "dismiss"].includes(action)) {
      return NextResponse.json({ error: "bad_action" }, { status: 400 });
    }
    result = await reviewResolutionCandidate(id, action as CandidateReviewAction, entityId, note);
  } else if (target === "relationship_candidate") {
    if (action === "approve") result = await promoteCandidate(id, note);
    else if (action === "reject") result = await rejectCandidate(id, note);
    else return NextResponse.json({ error: "bad_action" }, { status: 400 });
  } else if (target === "correction") {
    if (!["investigate", "resolve", "dismiss", "dispute"].includes(action)) {
      return NextResponse.json({ error: "bad_action" }, { status: 400 });
    }
    result = await reviewCorrection(id, action as "investigate" | "resolve" | "dismiss" | "dispute", note);
  } else {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.redirect(new URL("/admin/review", req.url), 303);
}
