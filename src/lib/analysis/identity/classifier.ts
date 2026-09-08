// Identity-framing classifier (luku 3) — deterministic, versioned, auditable.
//
// Given an article and the people it mentions, this module finds the identity
// expressions the media attached to each person (e.g. "suomalainen",
// "Suomen kansalainen", "helsinkiläinen", "maahanmuuttaja"). It:
//   - only scans text that mentions the person (attribution guard),
//   - stores the verbatim expression as found,
//   - NEVER derives facts (birth country / citizenship) — those come from
//     explicit curated facts only,
//   - is pure and recomputable.

import { createHash } from "node:crypto";
import type { MediaIdentityTermCategory } from "@prisma/client";
import { matchIdentityTerms } from "./lexicon";

export const IDENTITY_CLASSIFIER_VERSION = "identity_framing_v1";
export const IDENTITY_MODEL_VERSION = "lexicon-v1";
export const IDENTITY_PROMPT_VERSION = "none";

export interface PersonRef {
  entityId: string;
  /** Canonical + alias names to search for attribution. */
  names: string[];
}

export interface ArticleText {
  title: string | null;
  excerpt: string | null;
  /** Entity ids already known to headline the article (ArticleMention.headlineMention). */
  headlinePersonEntityIds?: string[];
}

export interface ClassifiedMention {
  personEntityId: string;
  expression: string;
  expressionNormalized: string;
  termCategory: MediaIdentityTermCategory;
  termId: string;
  context: string | null;
  inHeadline: boolean;
  confidence: number;
  sourceSnapshot: string;
}

export interface AnalyzeResult {
  mentions: ClassifiedMention[];
  /** How many persons were scanned (regardless of detections). */
  scannedPersons: number;
  /** Deterministic hash of the whole input — used as the run snapshot. */
  snapshot: string;
}

const CASE_ENDING = "(?:n|ssa|sta|lla|lle|lta|na|t|ta|seen|an)?";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function personNamePattern(raw: string): RegExp {
  const name = escapeRe(raw.trim());
  return new RegExp(`(?:^|[^\\p{L}])${name}${CASE_ENDING}(?=[^\\p{L}]|$)`, "iu");
}

function sentenceCandidates(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?…])\s+|(?<=\n)\s*/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when the sentence mentions the person by any name variant. */
function sentenceMentionsPerson(person: PersonRef, sentence: string): boolean {
  return person.names.some((n) => {
    if (!n || n.trim().length < 2) return false;
    return personNamePattern(n).test(sentence);
  });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Deterministic snapshot hash of the classifier inputs. */
export function snapshotHash(...parts: (string | null | undefined)[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}

function buildMention(
  person: PersonRef,
  found: { expression: string; expressionNormalized: string; termCategory: MediaIdentityTermCategory; termId: string },
  context: string | null,
  inHeadline: boolean,
  confidence: number,
  snapshot: string,
): ClassifiedMention {
  return {
    personEntityId: person.entityId,
    expression: found.expression,
    expressionNormalized: found.expressionNormalized,
    termCategory: found.termCategory,
    termId: found.termId,
    context,
    inHeadline,
    confidence,
    sourceSnapshot: snapshot,
  };
}

/** Deduplicate mentions of the same person+expression (prefer headline / higher confidence). */
function dedupeMentions(mentions: ClassifiedMention[]): ClassifiedMention[] {
  const byKey = new Map<string, ClassifiedMention>();
  for (const m of mentions) {
    const key = `${m.personEntityId}|${m.expressionNormalized}|${m.termCategory}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    if (m.inHeadline && !prev.inHeadline) byKey.set(key, m);
    else if (m.confidence > prev.confidence && !prev.inHeadline) byKey.set(key, { ...m, inHeadline: prev.inHeadline });
  }
  return [...byKey.values()];
}

// Explicit birth-statement parsing. Recognises ONLY explicit phrasing
// ("syntyi X:ssa", "syntynyt X:ssä") inside a sentence that names the person.
// It never guesses a place from a name: the phrase must name a place token.
const EXPLICIT_BIRTH_VERB_RE = /\b(syntynyt|syntyi|on syntyisin)\b/giu;
const PLACE_TOKEN_RE = /^\s+([A-ZÅÄÖ][\p{L}\-]{1,40}(?:\s+[A-ZÅÄÖ][\p{L}\-]{1,40})?)/u;

export interface ExplicitBirthStatement {
  /** The whole statement verbatim, e.g. "syntynyt Kabulissa". */
  statement: string;
  /** The place token verbatim, e.g. "Kabulissa". */
  place: string;
  /** Base form used as a stable key (suffix stripped), e.g. "Kabul". */
  base: string;
}

const FINNISH_PLACE_SUFFIXES = ["iksi", "ssa", "ssä", "lla", "llä", "sta", "stä", "issa", "issä", "ona", "ssaan", "ään", "an", "än", "n"];

function toBase(place: string): string {
  let base = place.toLowerCase();
  for (const suf of FINNISH_PLACE_SUFFIXES) {
    if (base.length > 3 && base.endsWith(suf)) {
      base = base.slice(0, base.length - suf.length);
      break;
    }
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function parseExplicitBirthStatements(text: string): ExplicitBirthStatement[] {
  const out: ExplicitBirthStatement[] = [];
  const re = new RegExp(EXPLICIT_BIRTH_VERB_RE.source, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = text.slice(re.lastIndex);
    const placeMatch = after.match(PLACE_TOKEN_RE);
    if (!placeMatch) continue;
    const place = placeMatch[1].trim();
    const placeOffsetInAfter = after.indexOf(place);
    const statementEnd = re.lastIndex + placeOffsetInAfter + place.length;
    out.push({ statement: text.slice(m.index, statementEnd).trim(), place, base: toBase(place) });
    if (re.lastIndex === m.index) re.lastIndex += 1;
  }
  return out;
}

/**
 * Classify identity expressions for all mentioned persons in one article.
 * Deterministic: identical inputs produce identical outputs.
 */
export function analyzeArticle(input: ArticleText & { persons: PersonRef[] }): AnalyzeResult {
  const title = input.title ?? "";
  const excerpt = input.excerpt ?? "";
  const headlineSet = new Set(input.headlinePersonEntityIds ?? []);
  const mentions: ClassifiedMention[] = [];

  for (const person of input.persons) {
    const titleMentionsPerson = title.length > 0 && sentenceMentionsPerson(person, title);

    // 1) body: only sentences that name the person (attribution guard)
    const sentences = sentenceCandidates(excerpt);
    const namedSentences = sentences.filter((s) => sentenceMentionsPerson(person, s));
    const windowText = normalizeText(namedSentences.join(" "));
    if (windowText.length > 0) {
      const snapshot = snapshotHash(title, excerpt, windowText);
      for (const found of matchIdentityTerms(windowText, windowText.toLowerCase())) {
        mentions.push(
          buildMention(
            person,
            {
              expression: found.verbatim,
              expressionNormalized: found.expressionNormalized,
              termCategory: found.def.category,
              termId: found.def.id,
            },
            windowText.length > 160 ? windowText.slice(0, 160) + "…" : windowText,
            false,
            0.85,
            snapshot,
          ),
        );
      }
      // explicit "syntyi X:ssa" statements within the person's own sentence
      for (const stmt of parseExplicitBirthStatements(windowText)) {
        mentions.push(
          buildMention(
            person,
            {
              expression: stmt.statement,
              expressionNormalized: stmt.statement.toLowerCase().replace(/\s+/g, " ").trim(),
              termCategory: "PLACE_OF_BIRTH",
              termId: `explicit_birth:${stmt.base.toLowerCase()}`,
            },
            windowText.length > 160 ? windowText.slice(0, 160) + "…" : windowText,
            false,
            0.9,
            snapshot,
          ),
        );
      }
    }

    // 2) headline: only when the headline names the person
    if (titleMentionsPerson || headlineSet.has(person.entityId)) {
      const snapshot = snapshotHash(title, excerpt);
      for (const found of matchIdentityTerms(title, title.toLowerCase())) {
        mentions.push(
          buildMention(
            person,
            {
              expression: found.verbatim,
              expressionNormalized: found.expressionNormalized,
              termCategory: found.def.category,
              termId: found.def.id,
            },
            title.length > 160 ? title.slice(0, 160) + "…" : title,
            true,
            0.75,
            snapshot,
          ),
        );
      }
    }
  }

  return {
    mentions: dedupeMentions(mentions),
    scannedPersons: input.persons.length,
    snapshot: snapshotHash(title, excerpt, input.persons.map((p) => p.entityId).join(",")),
  };
}