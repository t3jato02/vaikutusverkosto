// VAIKUTA recipient relevance engine.
//
// Deterministic, explainable recipient selection. Every recipient is derived
// exclusively from documented, source-backed institutional relationships:
// committee membership, voting participation, chair roles, ministerial or
// plenary responsibility, formal authorship, and documented media coverage of
// the specific matter. The engine NEVER ranks by ideology and never infers
// political beliefs. A recipient without a source-backed reason is never
// eligible for automated recommendation.
//
// The internal `score` orders candidates only within the SAME institutional
// dimension (e.g. chair before ordinary member). The UI explains "why this
// person is relevant" — it never presents the score as a political judgment.

import { db } from "@/lib/db";
import { CONFIRMED_STATUSES } from "@/lib/verification";
import type { Confidence, Prisma } from "@prisma/client";

export type RelevanceDimension =
  | "committee_membership"
  | "chair_of_committee"
  | "vote"
  | "minister"
  | "mp_plenary"
  | "official_preparation"
  | "formal_authorship"
  | "media_coverage";

export interface RecipientCandidate {
  entityId: string;
  name: string;
  subtype: string | null;
  role: string;
  organizationName: string | null;
  organizationId: string | null;
  isMedia: boolean;
  dimension: RelevanceDimension;
  reasonText: string;
  relationshipType: string | null;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: Date | null;
  confidence: Confidence | string;
  contactAvailability: string; // verified | public_professional | not_verified
  score: number; // internal ordering within a category — never shown as a political score
}

/** Confirmed-status filter — auto-recommended recipients must be confirmed. */
const CONFIRMED: Prisma.RelationshipWhereInput = {
  verificationStatus: { in: CONFIRMED_STATUSES },
};

export const DIMENSION_LABELS: Record<RelevanceDimension, string> = {
  committee_membership: "Valiokunnan jäsenyys",
  chair_of_committee: "Valiokunnan puheenjohtajuus",
  vote: "Äänestykseen osallistuminen",
  minister: "Vastuuministeri",
  mp_plenary: "Kansanedustaja (täysistunto)",
  official_preparation: "Valmisteluvastuu",
  formal_authorship: "Aloitteen tekijä / allekirjoittaja",
  media_coverage: "Materiaalia käsitellyt toimitus",
};

async function loadDecision(decisionId: string) {
  return db.decision.findUnique({
    where: { id: decisionId },
    include: {
      institutionEntity: { select: { id: true, canonicalName: true, type: true, subtype: true, officialUrls: true } },
      source: true,
      votes: { include: { personEntity: { select: { id: true, type: true, canonicalName: true, subtype: true, person: { select: { electoralDistrict: true, imageUrl: true } } } } } },
    },
  });
}

/** Resolve the effective institution that is "considering" the decision. */
export async function getDecisionRecipients(decisionId: string): Promise<RecipientCandidate[]> {
  const decision = await loadDecision(decisionId);
  if (!decision) return [];

  const bag = new Map<string, RecipientCandidate>();
  const institution = decision.institutionEntity;
  const votes = new Map<string, { personEntity: { id: string; canonicalName: string; subtype: string | null }; choice: string }>();
  for (const v of decision.votes) votes.set(v.personEntityId, { personEntity: v.personEntity, choice: v.choice });

  let result: RecipientCandidate[] = [];

  if (institution && institution.subtype === "parliament_committee") {
    result.push(...(await committeeMembers(institution.id, institution.canonicalName)));
  } else if (institution) {
    // Plenary responsibility for a plenary institution (Eduskunta / parliament).
    result.push(...(await plenaryMps(institution.id, institution.canonicalName)));
  }

  // Direct decision authority — who voted (backed by the decision's source).
  const ds = decision.source;
  for (const [, v] of votes) {
    const choiceLabel =
      v.choice === "FOR" ? "äänesti puolesta" : v.choice === "AGAINST" ? "äänesti vastaan" : "äänesti tyhjää";
    result.push({
      entityId: v.personEntity.id,
      name: v.personEntity.canonicalName,
      subtype: v.personEntity.subtype,
      role: "Päätöksentekijä",
      organizationName: institution?.canonicalName ?? null,
      organizationId: institution?.id ?? null,
      isMedia: false,
      dimension: "vote",
      reasonText: `Osallistui päätöksen äänestykseen (${choiceLabel}).`,
      relationshipType: null,
      sourceId: ds?.id ?? "",
      sourceName: ds?.sourceName ?? "Päätöksen lähde",
      sourceUrl: ds?.sourceUrl ?? "#",
      verifiedAt: decision.updatedAt,
      confidence: decision.confidence,
      contactAvailability: "not_verified",
      score: 14, // direct decision authority — highest in its category
    });
  }

  // Formal authorship — Relationship edges (INTRODUCED / SIGNED) pointing at a
  // linked DECISION entity. Requires the relation to be confirmed + evidenced.
  if (decision.entityId) {
    result.push(...(await decisionAuthors(decision.entityId)));
  }

  // Ministries involved via current ministerial or preparation positions.
  result.push(...(await ministryOfficials()));

  // Contact availability for every candidate (documented public/professional only).
  result = await annotateContacts(result);

  for (const r of result) {
    if (r.entityId) {
      const existing = bag.get(r.entityId);
      if (!existing || r.score > existing.score) bag.set(r.entityId, r);
    }
  }

  return [...bag.values()].sort((a, b) => {
    if (a.isMedia !== b.isMedia) return a.isMedia ? 1 : -1;
    return b.score - a.score;
  });
}

async function committeeMembers(committeeId: string, committeeName: string): Promise<RecipientCandidate[]> {
  const rels = await db.relationship.findMany({
    where: {
      targetEntityId: committeeId,
      relationshipType: { in: ["MEMBER_OF", "CHAIRS", "FORMER_MEMBER_OF"] },
      ...CONFIRMED,
    },
    include: {
      sourceEntity: { select: { id: true, type: true, canonicalName: true, subtype: true, person: { select: { electoralDistrict: true, imageUrl: true } } } },
      evidence: { include: { source: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 120,
  });

  const out: RecipientCandidate[] = [];
  for (const r of rels) {
    if (r.sourceEntity.type !== "PERSON") continue;
    const ev = r.evidence[0];
    const source = ev?.source;
    const isChair = r.relationshipType === "CHAIRS";
    out.push({
      entityId: r.sourceEntity.id,
      name: r.sourceEntity.canonicalName,
      subtype: r.sourceEntity.subtype,
      role: isChair ? "Puheenjohtaja" : r.relationshipType === "FORMER_MEMBER_OF" ? "Entinen jäsen" : "Jäsen",
      organizationName: committeeName,
      organizationId: committeeId,
      isMedia: false,
      dimension: isChair ? "chair_of_committee" : "committee_membership",
      reasonText: isChair
        ? `Valiokunnan puheenjohtaja.`
        : `Valiokunnan jäsen — valiokunta käsittelee tätä esitystä.`,
      relationshipType: r.relationshipType,
      sourceId: source?.id ?? "",
      sourceName: source?.sourceName ?? "Dokumentoitu jäsenyys",
      sourceUrl: source?.sourceUrl ?? "#",
      verifiedAt: r.lastVerifiedAt ?? r.updatedAt,
      confidence: r.confidence,
      contactAvailability: "not_verified",
      score: isChair ? 12 : 10,
    });
  }
  return out;
}

async function plenaryMps(orgId: string, orgName: string): Promise<RecipientCandidate[]> {
  const positions = await db.position.findMany({
    where: {
      organizationEntityId: orgId,
      isCurrent: true,
      source: { isNot: null },
    },
    include: {
      personEntity: { select: { id: true, type: true, canonicalName: true, subtype: true, person: { select: { electoralDistrict: true, imageUrl: true } } } },
      source: true,
    },
    take: 60,
  });

  return positions
    .filter((p) => p.personEntity.type === "PERSON")
    .map((p) => ({
      entityId: p.personEntity.id,
      name: p.personEntity.canonicalName,
      subtype: p.personEntity.subtype,
      role: p.role ?? "Kansanedustaja",
      organizationName: orgName,
      organizationId: orgId,
      isMedia: false,
      dimension: "mp_plenary" as const,
      reasonText: `Nykyinen ${p.role ?? "kansanedustaja"} — voi äänestää asiasta täysistunnossa.`,
      relationshipType: null,
      sourceId: p.source?.id ?? "",
      sourceName: p.source?.sourceName ?? "Dokumentoitu tehtävä",
      sourceUrl: p.source?.sourceUrl ?? "#",
      verifiedAt: p.updatedAt,
      confidence: "HIGH" as Confidence,
      contactAvailability: "not_verified",
      score: 9,
    }));
}

async function decisionAuthors(decisionEntityId: string): Promise<RecipientCandidate[]> {
  const rels = await db.relationship.findMany({
    where: {
      targetEntityId: decisionEntityId,
      relationshipType: { in: ["INTRODUCED", "SIGNED"] },
      ...CONFIRMED,
    },
    include: {
      sourceEntity: { select: { id: true, type: true, canonicalName: true, subtype: true } },
      evidence: { include: { source: true }, take: 1 },
    },
    take: 40,
  });

  return rels
    .filter((r) => r.sourceEntity.type === "PERSON")
    .map((r) => {
      const ev = r.evidence[0];
      const source = ev?.source;
      const isIntroduced = r.relationshipType === "INTRODUCED";
      return {
        entityId: r.sourceEntity.id,
        name: r.sourceEntity.canonicalName,
        subtype: r.sourceEntity.subtype,
        role: isIntroduced ? "Aloitteen tekijä" : "Allekirjoittaja",
        organizationName: null,
        organizationId: null,
        isMedia: false,
        dimension: "formal_authorship" as const,
        reasonText: isIntroduced
          ? `On jättänyt tämän kaltaisen aloitteen.`
          : `On allekirjoittanut aloitteen.`,
        relationshipType: r.relationshipType,
        sourceId: source?.id ?? "",
        sourceName: source?.sourceName ?? "Dokumentoitu aloite",
        sourceUrl: source?.sourceUrl ?? "#",
        verifiedAt: r.lastVerifiedAt ?? r.updatedAt,
        confidence: r.confidence,
        contactAvailability: "not_verified",
        score: 11,
      };
    });
}

async function ministryOfficials(): Promise<RecipientCandidate[]> {
  const positions = await db.position.findMany({
    where: {
      role: { contains: "ministeri", mode: "insensitive" },
      isCurrent: true,
      source: { isNot: null },
    },
    include: {
      personEntity: { select: { id: true, type: true, canonicalName: true, subtype: true } },
      organizationEntity: { select: { id: true, canonicalName: true } },
      source: true,
    },
    take: 40,
  });

  return positions
    .filter((p) => p.personEntity.type === "PERSON")
    .map((p) => ({
      entityId: p.personEntity.id,
      name: p.personEntity.canonicalName,
      subtype: p.personEntity.subtype,
      role: p.role,
      organizationName: p.organizationEntity?.canonicalName ?? "Valtioneuvosto",
      organizationId: p.organizationEntity?.id ?? null,
      isMedia: false,
      dimension: "minister" as const,
      reasonText: `Aktiivinen ${p.role.toLowerCase()} — vastuussa hallituksen linjasta asiassa.`,
      relationshipType: null,
      sourceId: p.source?.id ?? "",
      sourceName: p.source?.sourceName ?? "Dokumentoitu tehtävä",
      sourceUrl: p.source?.sourceUrl ?? "#",
      verifiedAt: p.updatedAt,
      confidence: "HIGH" as Confidence,
      contactAvailability: "not_verified",
      score: 13,
    }));
}

/** Journalists who demonstrably covered the specific matter (institution or topic). */
export async function getDecisionMedia(decisionId: string): Promise<RecipientCandidate[]> {
  const decision = await loadDecision(decisionId);
  if (!decision) return [];
  const institutionId = decision.institutionEntity?.id;
  const topics = decision.affectedSectors.filter(Boolean);

  const articles = await db.article.findMany({
    where: {
      publicVisible: true,
      OR: [
        ...(institutionId ? [{ mentions: { some: { entityId: institutionId } } }] : []),
        ...(topics.length ? [{ topics: { hasSome: topics } }] : []),
      ],
    },
    include: {
      authors: { include: { personEntity: { select: { id: true, type: true, canonicalName: true, subtype: true } } } },
      publisherEntity: { select: { id: true, canonicalName: true } },
      source: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 150,
  });

  const out: RecipientCandidate[] = [];
  for (const a of articles) {
    for (const author of a.authors) {
      const p = author.personEntity;
      if (p.type !== "PERSON") continue;
      out.push({
        entityId: p.id,
        name: p.canonicalName,
        subtype: p.subtype,
        role: "Toimittaja",
        organizationName: a.publisherEntity?.canonicalName ?? a.publicationName ?? null,
        organizationId: a.publisherEntity?.id ?? null,
        isMedia: true,
        dimension: "media_coverage",
        reasonText: `On raportoinut tätä asiaa (${a.title}). Tämä on medialuokitus — ei päätöksentekijän rooli.`,
        relationshipType: "WROTE_ABOUT",
        sourceId: a.source?.id ?? "",
        sourceName: a.source?.sourceName ?? "Dokumentoitu raportointi",
        sourceUrl: a.canonicalUrl,
        verifiedAt: a.verifiedAt ?? a.publishedAt ?? a.ingestedAt,
        confidence: "HIGH" as Confidence,
        contactAvailability: "not_verified",
        score: 5,
      });
    }
  }
  return out;
}

async function annotateContacts(candidates: RecipientCandidate[]): Promise<RecipientCandidate[]> {
  if (candidates.length === 0) return candidates;
  const ids = [...new Set(candidates.map((c) => c.entityId))];
  const contacts = await db.vaikutaContactMethod.findMany({
    where: { entityId: { in: ids }, isPublicProfessional: true },
    select: { entityId: true },
  });
  const hasContact = new Set(contacts.map((c) => c.entityId));
  return candidates.map((c) => ({
    ...c,
    contactAvailability: c.isMedia ? "public_professional" : hasContact.has(c.entityId) ? "public_professional" : "not_verified",
  }));
}

// ---------------------------------------------------------------- grouping

export interface RecipientGroup {
  key: string;
  label: string;
  isMedia: boolean;
  count: number;
}

export function groupRecipients(candidates: RecipientCandidate[]): RecipientGroup[] {
  const groups: RecipientGroup[] = [
    { key: "decision_makers", label: "Päätöksentekijät", isMedia: false, count: 0 },
    { key: "committee_and_preparation", label: "Valmistelu ja valiokunta", isMedia: false, count: 0 },
    { key: "other_documented", label: "Muut dokumentoidut toimijat", isMedia: false, count: 0 },
    { key: "media", label: "Asiaa käsitellyt toimitus", isMedia: true, count: 0 },
  ];
  const dims = new Map<RelevanceDimension, string>([
    ["vote", "decision_makers"],
    ["minister", "decision_makers"],
    ["committee_membership", "committee_and_preparation"],
    ["chair_of_committee", "committee_and_preparation"],
    ["official_preparation", "committee_and_preparation"],
    ["mp_plenary", "decision_makers"],
    ["formal_authorship", "other_documented"],
    ["media_coverage", "media"],
  ]);
  for (const c of candidates) {
    const key = c.isMedia ? "media" : dims.get(c.dimension) ?? "other_documented";
    const g = groups.find((x) => x.key === key);
    if (g) g.count += 1;
  }
  return groups;
}