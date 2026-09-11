// Conservative, transparent "framing" estimate (sections 4, 18).
//
// This is an OPT-IN, clearly-labelled automatic estimate of whether a piece of
// text appears to present its subject positively / neutrally / critically.
// It is intentionally crude: it uses a small fixed Finnish lexicon on the
// headline + short excerpt only, never on a person's identity, and it returns
// low confidence. It must never be presented as evidence of anyone's political
// stance — the UI always pairs it with
//   "Sisältöanalyysi ei osoita toimittajan henkilökohtaista poliittista
//    mielipidettä."
//
// Constants: language "fi", lexicon v1.

export type FramingBucket = "positive" | "neutral" | "critical";

const POSITIVE = new Set([
  "vahva", "vahvaa", "hyvä", "hyvää", "keskeinen", "keskeistä", "sujuu", "luottamus",
  "paranee", "parani", "onnistui", "onnistuu", "kasvu", "kasvua", "nousu", "nousua",
  "suosio", "suosiota", "puhdas", "kaunis", "turvallinen", "vakaata", "vakaa",
  "innovaatio", "menestys", "menetys", "terve", "parempi", "paras", "avoin",
  "avoimuus", "läpinäkyvä", "vahvistaa", "edistää", "tukee", "voitto", "voittoa",
]);

const CRITICAL = new Set([
  "kriisi", "kriisiä", "ongelma", "ongelmia", "puutos", "huoli", "huolta", "riski",
  "riskejä", "vaara", "vaarassa", "heikko", "heikkoa", "heikkous", "lasku", "laskua",
  "romahdus", "romahdi", "epäonnistui", "epäonnistuu", "vuoto", "väärin", "väärinkäytös",
  "korruptio", "skandaali", "sota", "konflikti", "uhattuna", "taantuu", "taantuma",
  "leikkaus", "leikkauksia", "kritiikki", "kritiikkiä", "syytös", "syytöksiä", "tuomio",
  "putoaa", "kaatuu", "kaatui", "erimielisyys", "kohu", "kohua", "myrkyllinen",
]);

const NEGATIONS = new Set(["ei", "eivät", "en", "eikä", "harva", "harvoin", "ilman", "ei_ole", "vastaan", "kiistää", "kiisti"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zåäö0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Estimate the framing of one headline+excerpt towards its subject. */
export function estimateFraming(text: string | null | undefined): FramingBucket {
  const clean = (text ?? "").trim();
  if (!clean) return "neutral";
  const toks = tokens(clean);
  let positive = 0;
  let critical = 0;
  let negate = false;
  for (const raw of toks) {
    const t = raw.replace(/[,.;:!?]/g, "");
    if (NEGATIONS.has(t)) {
      negate = true;
      continue;
    }
    if (POSITIVE.has(t)) {
      positive += negate ? -1 : 1;
    } else if (CRITICAL.has(t)) {
      critical += negate ? -1 : 1;
    }
    negate = false;
  }
  if (positive === critical) return "neutral";
  return positive > critical ? "positive" : "critical";
}

/** Simple per-article framing bucket with a deliberately low confidence. */
export function framingConfidence(bucket: FramingBucket, textLength: number): number {
  // Short excerpts are inherently noisy; confidence stays low unless the text
  // was long enough to contain several signal words.
  if (textLength < 40) return 0.12;
  if (textLength < 120) return 0.2;
  if (bucket === "neutral") return 0.25;
  return 0.35;
}