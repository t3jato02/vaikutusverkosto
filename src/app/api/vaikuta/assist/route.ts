import { NextResponse } from "next/server";
import { authedJson, apiError } from "@/lib/vaikuta/http";
import { aiAssistEnabled } from "@/lib/vaikuta/flags";
import { db } from "@/lib/db";
import { assistAddReferences, assistClarify, assistCheckFactualClaims, assistFormal, assistQuestion, assistShorten } from "@/lib/vaikuta/assist";

const ACTIONS = new Set(["clarify", "shorten", "formal", "question", "references", "check_facts"]);

interface AssistBody {
  action?: string;
  text?: string;
  decisionId?: string;
  maxChars?: number;
}

// POST /api/vaikuta/assist — deterministic, local message assistance.
// Preserves the user's position; never invents facts or arguments.
export async function POST(req: Request) {
  const auth = await authedJson<AssistBody>(req);
  if (!auth.ok) return auth.res;
  if (!aiAssistEnabled()) return apiError(403, "ai_assist_disabled");

  const action = String(auth.ctx.body?.action ?? "");
  const text = String(auth.ctx.body?.text ?? "");
  if (!ACTIONS.has(action)) return apiError(400, "unknown_action");
  if (!text.trim()) return apiError(400, "text_required");

  let decisionRefs: { title: string; sources: { sourceName: string; sourceUrl: string }[] } | null = null;
  const decisionId = String(auth.ctx.body?.decisionId ?? "");
  if (decisionId) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { source: true, stages: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (decision) {
      const sources = [
        ...(decision.source ? [{ sourceName: decision.source.sourceName, sourceUrl: decision.source.sourceUrl }] : []),
        ...decision.stages
          .map((s) => s.source)
          .filter((s): s is NonNullable<typeof s> => s !== null)
          .map((s) => ({ sourceName: s.sourceName, sourceUrl: s.sourceUrl })),
      ];
      decisionRefs = { title: decision.title, sources };
    }
  }

  let outcome: { text: string; changed: boolean; note: string; claimsToVerify?: string[] };
  switch (action) {
    case "clarify":
      outcome = assistClarify(text);
      break;
    case "shorten":
      outcome = assistShorten(text, auth.ctx.body?.maxChars && Number.isFinite(auth.ctx.body.maxChars) ? Math.min(4000, Math.max(100, Math.round(auth.ctx.body.maxChars))) : 1400);
      break;
    case "formal":
      outcome = assistFormal(text);
      break;
    case "question":
      outcome = assistQuestion(text);
      break;
    case "references":
      if (!decisionRefs || decisionRefs.sources.length === 0) return apiError(400, "no_references_available");
      outcome = assistAddReferences(text, decisionRefs);
      break;
    case "check_facts": {
      const check = decisionRefs ? assistCheckFactualClaims(text, decisionRefs) : { changed: false, note: "Ei päätösviitteitä tarkistusta varten.", claimsToVerify: [] };
      return NextResponse.json({ ok: true, changed: check.changed, note: check.note, claimsToVerify: check.claimsToVerify });
    }
    default:
      return apiError(400, "unknown_action");
  }

  await db.vaikutaEvent.create({
    data: { eventType: "ai_assist_used", userId: auth.ctx.userId, decisionId: decisionId || null, metadata: { action } },
  });

  return NextResponse.json({ ok: true, ...outcome });
}