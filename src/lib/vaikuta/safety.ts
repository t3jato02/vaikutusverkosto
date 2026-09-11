// VAIKUTA message validation and safety controls.
//
// The initial product is NOT an unrestricted bulk-mail system. These are
// deterministic, testable rules applied at the domain level regardless of any
// delivery provider:
//   - content validation (lengths, shape)
//   - abuse heuristics → REQUIRES_MODERATION (narrow, never political content)
//   - duplicate-campaign protection (protects individual recipients)
//   - per-user campaign rate limits
//
// Political disagreement, criticism and strongly worded lawful opinions are
// NOT abuse by themselves and must never trip these heuristics.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const MAX_SUBJECT = 140;
export const MIN_BODY = 40;
export const MAX_BODY = 20_000;
export const MAX_TITLE = 160;
export const MAX_RECIPIENTS_SELECTION = 500;

export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CAMPAIGNS_PER_HOUR = 3;
export const CAMPAIGNS_PER_DAY = 20;
export const IDENTICAL_RECIPIENT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type SafetyFlag = {
  code: string;
  label: string;
  detail: string;
};

export interface MessageCheck {
  ok: boolean;
  errors: string[];
  subject: string;
  body: string;
  flags: SafetyFlag[];
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const DOUBLE_CHARS_RE = /\p{L}\p{L}\p{L}\p{L}\p{L}\p{L}\p{L}\p{L}\p{L}\p{L}{60,}/u;
const MOBILE_PHONE_RE = /(\+358\s?4[0-9]\s?\d{3}\s?\d{3,})|(0\s?4[0-9][0-9\s-]{6,})/i;
const HOME_ADDRESS_HINT_RE =
  /(kotiosoite|kotiosoitetta|yksityinen osoite|yksityissähköposti|henkilökohtainen numer|omat yhteystietojansa?)\b/i;
const IMPERSONATION_RE =
  /(kirjoitan\s+(?:sinulle|teille)\s+(\S+\s+){0,3}(ministeri|kansanedustajan|viraston)\s+nimissä)|(väitän olevani\s+\S+)|(virallisena\s+(?:edustajana|puolesta))/i;
const PHISHING_HINTS_RE = /(verify|vahvista\b|angry|urgent|välittömästi\b|unusual (?:signin|activity)|salasanasi|tilisi|pääsy katkeaa)/i;
const SHORTENER_RE = /(bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|buff\.ly)/i;

export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function contentHash(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Validate + statically screen a message. Pure and synchronous so unit tests
 * can exercise every rule without a database. `flags` are advisory signals
 * that trigger REQUIRES_MODERATION upstream — they never modify the text.
 */
export function checkMessage(subjectRaw: unknown, bodyRaw: unknown): MessageCheck {
  const subject = cleanText(subjectRaw, MAX_SUBJECT);
  const body = cleanText(bodyRaw, MAX_BODY);
  const errors: string[] = [];
  const flags: SafetyFlag[] = [];

  if (!subject) errors.push("subject_required");
  else if (subject.length < 4) errors.push("subject_too_short");

  if (!body) errors.push("body_required");
  else if (body.length < MIN_BODY) errors.push("body_too_short");

  // Multi-line safety review — never hidden inside a single long gutter line.
  const multilineClean = body.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");

  const urls = (multilineClean.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
  if (urls.length > 3) {
    flags.push({ code: "url_heavy", label: "Linkkien määrä", detail: "Viesti sisältää paljon linkkejä — voi olla roskapostia." });
  }
  if (urls.some((u) => SHORTENER_RE.test(u))) {
    flags.push({ code: "url_shortener", label: "Linkkejä lyhentäjäverkkotunnuksilla", detail: "Lyhennetyt linkit ovat tyypillinen phishing-merkki." });
  }
  if (PHISHING_HINTS_RE.test(multilineClean) && /(salasana|tili|kortti|pankki)/i.test(multilineClean)) {
    flags.push({ code: "phishing_hint", label: "Mahdollinen tietojenkalastelu", detail: "Viestissä pyydetään yksityisiä tietoja." });
  }
  if (MOBILE_PHONE_RE.test(multilineClean) && HOME_ADDRESS_HINT_RE.test(multilineClean)) {
    flags.push({ code: "doxxing_hint", label: "Yksityisten tietojen jakaminen", detail: "Yksityinen puhelinnumero yksityisen osoitteen yhteydessä." });
  }
  if (IMPERSONATION_RE.test(multilineClean)) {
    flags.push({ code: "impersonation", label: "Mahdollinen esiintyminen toisen henkilönä", detail: "Viesti vaikuttaa viralliselta taholta tulevalta." });
  }
  if (DOUBLE_CHARS_RE.test(subject + body)) {
    errors.push("garbled_text");
  }

  return { ok: errors.length === 0, errors, subject, body, flags };
}

/** Private-contact spray risk: repeated identical bodies toward one recipient. */
export function isIdenticalTo(body: string, previous: string): boolean {
  return contentHash(body) === contentHash(previous);
}

// ---------------------------------------------------------------- DB-backed rules

export async function checkCampaignRateLimits(userId: string): Promise<{ allowed: boolean; retryAfterMs: number; reason?: string }> {
  if (process.env.DISABLE_VAIKUTA_CAMPAIGN_RATE_LIMIT === "1") {
    return { allowed: true, retryAfterMs: 0 };
  }
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [hourly, daily] = await Promise.all([
    db.influenceCampaign.count({ where: { userId, createdAt: { gte: hourAgo } } }),
    db.influenceCampaign.count({ where: { userId, createdAt: { gte: dayAgo } } }),
  ]);
  if (hourly >= CAMPAIGNS_PER_HOUR) {
    return { allowed: false, retryAfterMs: 60 * 60 * 1000, reason: "campaign_hourly_limit" };
  }
  if (daily >= CAMPAIGNS_PER_DAY) {
    return { allowed: false, retryAfterMs: 24 * 60 * 60 * 1000, reason: "campaign_daily_limit" };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Blocks repeated substantially identical campaigns aimed at the same target. */
export async function findOverlappingCampaign(input: {
  userId: string;
  decisionId: string;
  bodyHash: string;
  withinMs?: number;
}) {
  const since = new Date(Date.now() - (input.withinMs ?? DUPLICATE_WINDOW_MS));
  const campaigns = await db.influenceCampaign.findMany({
    where: {
      userId: input.userId,
      decisionId: input.decisionId,
      createdAt: { gte: since },
      status: { notIn: ["CLOSED", "SUSPENDED"] },
      messageBody: { not: null },
    },
    select: { id: true, title: true, createdAt: true, messageSubject: true, messageBody: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  // NOTE: comparing hashes computed over possible stale snapshots is handled
  // in the caller; here we return candidate campaigns for the identity check.
  return campaigns.filter((c) => c.messageBody && contentHash(c.messageBody) === input.bodyHash).map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt }));
}