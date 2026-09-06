import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import {
  reviewRelationship,
  reviewResolutionCandidate,
  reviewCorrection,
  reviewAffiliation,
  promoteCandidate,
  rejectCandidate,
  resolveSourceConflict,
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
  // Keyboard-driven review panel posts with mode=json and wants a JSON reply,
  // not a 303 back to the page.
  const wantsJson = String(form.get("mode") ?? "") === "json";

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
  } else if (target === "source_conflict") {
    if (!["resolve", "dismiss"].includes(action)) return NextResponse.json({ error: "bad_action" }, { status: 400 });
    result = await resolveSourceConflict(id, action as "resolve" | "dismiss", note);
  } else if (target === "correction") {
    if (!["investigate", "resolve", "dismiss", "dispute"].includes(action)) {
      return NextResponse.json({ error: "bad_action" }, { status: 400 });
    }
    result = await reviewCorrection(id, action as "investigate" | "resolve" | "dismiss" | "dispute", note);
  } else if (target === "affiliation") {
    if (!["approve", "reject", "dispute"].includes(action)) {
      return NextResponse.json({ error: "bad_action" }, { status: 400 });
    }
    result = await reviewAffiliation(id, action as "approve" | "reject" | "dispute", note);
  } else {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (wantsJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/admin/review", req.url), 303);
}
