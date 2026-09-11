// VAIKUTA AI message assistance — prototype, fully deterministic.
//
// These operations must preserve the user's actual position and must NEVER
// silently invent arguments or facts. Every action is a rule-based, local
// transformation (no external model, no hallucination surface). The UI labels
// them clearly as the assisted-refinement tools; the deterministic nature of
// each transformation is documented in /vaikuta/methodology.

export interface AssistOutcome {
  text: string;
  changed: boolean;
  note: string;
}

export interface DecisionRefs {
  title: string;
  sources: { sourceName: string; sourceUrl: string }[];
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Remove filler phrases and redundant repetition without changing meaning. */
export function assistClarify(text: string): AssistOutcome {
  const clean = text
    .replace(/\s+/g, " ")
    .replace(/\b(että|että nyt|ihan oikeasti)\b/gi, "että")
    .replace(/\b(hirveän|hirmu|todella todella)\b/gi, "erittäin")
    .replace(/\s+/g, " ")
    .trim();
  const out = sentences(clean).join("\n");
  return { text: out, changed: out !== text, note: "Poistettu täytesanoja ja jaoteltu virkkeet — sisältö säilytetty sellaisenaan." };
}

/** Shorten to roughly the requested length, keeping whole sentences. */
export function assistShorten(text: string, maxChars = 1400): AssistOutcome {
  if (text.length <= maxChars) return { text, changed: false, note: "Viesti mahtuu tavoitemittaan sellaisenaan." };
  const s = sentences(text);
  const trimmed: string[] = [];
  let len = 0;
  for (const sent of s) {
    if (len + sent.length + 3 > maxChars && trimmed.length > 0) break;
    trimmed.push(sent);
    len += sent.length + 3;
  }
  const out = trimmed.join("\n").trim();
  if (!out) return { text, changed: false, note: "Viestiä ei voitu lyhentää turvallisesti." };
  return {
    text: out,
    changed: out !== text,
    note: `Lyhennetty ${text.length} → ${out.length} merkkiin säilyttämällä kokonaiset virkkeet.`,
  };
}

// NOTE: `\b` is ASCII-only (it never sees ä/ö/å), so word anchors here use
// Unicode-aware lookaround boundaries instead.
const FORMAL_PAIRS: [RegExp, string][] = [
  [/(?<!\p{L})ihan\s+(hyvä|surkea|huono|iso|pieni|tärkeä)(?!\p{L})/giu, "varsin $1"],
  [/(?<!\p{L})niinku(?!\p{L})/giu, "kuten"],
  [/(?<!\p{L})se on ihan(?!\p{L})/giu, "se on varsin"],
  [/(?<!\p{L})sekä sit se että(?!\p{L})/giu, "sekä se, että"],
  [/(?<!\p{L})halbetti(?!\p{L})/giu, "epätoivottava"],
];

/** Neutral, formal phrasing. Only well-understood substitutions are applied. */
export function assistFormal(text: string): AssistOutcome {
  let out = text;
  for (const [re, repl] of FORMAL_PAIRS) out = out.replace(re, repl);
  out = out.replace(/\s+/g, " ").trim();
  return { text: out, changed: out !== text, note: "Hakuja korvattu neutraalemmilla muotoiluilla ilman sisältömuutoksia." };
}

/** Frame the message as a question, preserving the writer's position verbatim. */
export function assistQuestion(text: string): AssistOutcome {
  if (/[?؟¿]\s*$/.test(text.trim())) {
    return { text, changed: false, note: "Viesti on jo kysymysmuodossa." };
  }
  const out = `Olisin kiitollinen, jos voisit kertoa näkemyksesi tästä:\n\n${text.trim()}`;
  return { text: out, changed: true, note: "Viesti on kehystetty kohteliaaksi kysymykseksi; oma kantasi on säilynyt sanatarkasti." };
}

/**
 * Append factual references grounded in the decision's own documented sources.
 * Never invents references — only rows that already exist in the DB.
 */
export function assistAddReferences(text: string, refs: DecisionRefs): AssistOutcome {
  const block = [
    "",
    "---",
    `Viitattava päätös: ${refs.title}`,
    "Lähteet:",
    ...refs.sources.map((s, i) => `${i + 1}. ${s.sourceName} — ${s.sourceUrl}`),
  ].join("\n");
  return { text: `${text.trim()}\n${block}`, changed: true, note: "Lisätty päätöksen dokumentoidut lähteet pohjaksi." };
}

/**
 * Heuristic factual-claim scan. Returns the claims containing figures/dates
 * (which should be verified against the referenced material). It does NOT
 * assert truth — it lists what deserves a check.
 */
export function assistCheckFactualClaims(
  text: string,
  refs: DecisionRefs,
): { changed: boolean; note: string; claimsToVerify: string[] } {
  const claims = sentences(text).filter((s) => /(\d{2,}|€|%|\d\.\d{1,2}|[0-9]{1,2}[.\-/][0-9]{1,2}[.\-/][0-9]{2,4})/.test(s));
  const sourceCount = refs.sources.length;
  if (claims.length === 0) {
    return { changed: false, note: "Vahvistamista vaativia väitelauseita ei havaittu.", claimsToVerify: [] };
  }
  return {
    changed: false,
    note: `Havaittu ${claims.length} virkettä, joissa on lukuja tai päivämääriä — tarkista ne päätöksen lähdemateriaalista (${sourceCount} lähdettä) ennen lähetystä.`,
    claimsToVerify: claims,
  };
}