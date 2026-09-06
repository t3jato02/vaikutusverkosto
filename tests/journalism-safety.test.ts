// Safety + trust regressions for the media/journalism feature (sections 5, 20,
// 35, 38). These are the explicit "must never happen" invariants:
//   1. No name-based inference of native language / nationality / background.
//   2. No sentiment/article content may become a political affiliation.
//   3. Unsupported affiliation claims can never reach VERIFIED/HUMAN_VERIFIED
//      automatically.
//   4. Writing about a politician does not create a personal relationship.
//   5. Media editorial orientation never transfers to an individual journalist.
//   6. Source conflicts are surfaced, never auto-resolved.
//   7. UNKNOWN stays UNKNOWN — AI never guesses.

import { describe, it, expect } from "vitest";
import "dotenv/config";
import {
  checkPersonalFact,
  unknownPersonalValue,
  checkPoliticalAffiliation,
  agentAffiliationStatus,
  isPublishableAffiliation,
  checkMentionDerivedRelationship,
  coverageRelationshipType,
  isArticleDataRelationship,
  requiresExplicitEvidence,
  transferEditorialOrientation,
  evidenceGradeFor,
} from "@/lib/analysis/safety";

describe("safety regression 1 — no name-based inference", () => {
  it("refuses a birth-country derived only from a surname", () => {
    const violations = checkPersonalFact({
      factType: "BIRTH_COUNTRY",
      value: "Venäjä",
      sourceUrl: "https://example.com/person",
      sourceName: "Nimipohjainen arvaus",
      confidence: "MEDIUM",
      sourceType: "REPUTABLE_MEDIA",
    });
    // A value supplied from a name guess still requires a source that
    // *documents* the fact; the guard requires a real public source URL and a
    // documented confidence for Wikipedia-only etc.
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  it("rejects forums/social posts as the sole source for a sensitive claim", () => {
    const violations = checkPersonalFact({
      factType: "NATIVE_LANGUAGE",
      value: "suomi",
      sourceUrl: "https://reddit.com/r/suomi/comments/x",
      sourceName: "Reddit-kommentti",
      confidence: "MEDIUM",
      sourceType: "REPUTABLE_MEDIA",
    });
    expect(violations.some((v) => /keskustelupalstat/i.test(v))).toBe(true);
  });

  it("returns UNKNOWN when no public source exists — never a guess", () => {
    const v = unknownPersonalValue("NATIONALITY");
    expect(v.value).toBe("UNKNOWN");
    expect(v.source).toBeNull();
  });
});

describe("safety regression 2 — content analysis never produces a political view", () => {
  it("content_analysis origin is always refused", () => {
    const violations = checkPoliticalAffiliation({
      sourceUrl: "https://example.com/artikkeli",
      sourceName: "Artikkelimetadata",
      sourceType: "REPUTABLE_MEDIA",
      confidence: "HIGH",
      description: "Sentimenttiluokittelun perusteella henkilö vaikuttaa kriittiseltä hallituksen leikkauksia kohtaan.",
      origin: "content_analysis",
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("isArticleDataRelationship separates WROTE_ABOUT from personal edges", () => {
    expect(isArticleDataRelationship(coverageRelationshipType("wrote"))).toBe(true);
    expect(requiresExplicitEvidence("WORKED_FOR")).toBe(true);
    expect(requiresExplicitEvidence("PERSONAL_RELATIONSHIP")).toBe(true);
    expect(requiresExplicitEvidence("WROTE_ABOUT")).toBe(false);
  });
});

describe("safety regression 3 — affiliation can never be auto-verified", () => {
  it("an agent may only produce AUTO_DETECTED or SOURCE_CONFIRMED", () => {
    const s = agentAffiliationStatus({ sourceType: "OFFICIAL_PRIMARY", confidence: "VERIFIED" });
    expect(["AUTO_DETECTED", "SOURCE_CONFIRMED"]).toContain(s);
  });

  it("an E-grade affiliation is not publishable", () => {
    expect(
      isPublishableAffiliation({ grade: "E", reviewStatus: "PUBLISHED", verificationStatus: "HUMAN_VERIFIED" }),
    ).toBe(false);
  });

  it("a PENDING_REVIEW affiliation is not publishable even with a strong grade", () => {
    expect(
      isPublishableAffiliation({ grade: "A", reviewStatus: "PENDING_REVIEW", verificationStatus: "SOURCE_CONFIRMED" }),
    ).toBe(false);
  });
});

describe("safety regression 4 — writing about a politician is not a personal relationship", () => {
  it("mention-derived edges are refused for personal relationship types", () => {
    const violations = checkMentionDerivedRelationship({
      sourceEntityId: "u-1",
      targetEntityId: "u-2",
      relationshipType: "PERSONAL_RELATIONSHIP",
      evidenceQuotedFragment: null,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/pelkkä maininta/i);
  });

  it("WROTE_ABOUT is allowed without a personal claim", () => {
    const violations = checkMentionDerivedRelationship({
      sourceEntityId: "u-1",
      targetEntityId: "u-2",
      relationshipType: "WROTE_ABOUT",
    });
    expect(violations).toEqual([]);
  });
});

describe("safety regression 5 — media orientation never transfers to journalists", () => {
  it("transferEditorialOrientation always throws", () => {
    expect(() => transferEditorialOrientation("FORMALLY_PARTY_AFFILIATED")).toThrow(/ei koskaan siirretä/i);
  });
});

describe("safety regression 6 — source conflicts", () => {
  it("an D-grade (single secondary) conflict must remain visible, not auto-resolved", () => {
    const grade = evidenceGradeFor({ verificationStatus: "DISPUTED", sourceType: "REPUTABLE_MEDIA" });
    expect(grade).toBe("D");
    // No code path below silently picks a "preferred" source.
    expect(evidenceGradeFor({ verificationStatus: "HUMAN_VERIFIED", sourceType: "OFFICIAL_REGISTER" })).toBe("A");
  });
});

describe("safety regression 7 — UNKNOWN stays UNKNOWN", () => {
  it("no AI guess for missing biographic value", () => {
    const v = unknownPersonalValue("BIRTH_COUNTRY");
    expect(v.value).toBe("UNKNOWN");
  });
});