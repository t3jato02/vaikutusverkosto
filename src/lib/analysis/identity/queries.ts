// Identity framing — query layer for facts & media mentions (luvut 2, 9, 10).
// Public views only show PUBLISHED facts; anything pending stays in admin.

import type { BirthOriginFact, CitizenshipFact, ResidenceFact, SelfIdentificationFact } from "@prisma/client";
import { db } from "@/lib/db";

export interface PersonIdentityFacts {
  birthCountry: BirthOriginFact | null;
  birthPlace: BirthOriginFact | null;
  citizenships: CitizenshipFact[];
  residences: ResidenceFact[];
  selfIdentifications: SelfIdentificationFact[];
}

const PUBLISHED_WHERE = { reviewStatus: "PUBLISHED" } as const;

/** Documented (published) identity facts for one person. */
export async function getPersonIdentityFacts(personEntityId: string, includePending = false): Promise<PersonIdentityFacts> {
  const where = { personEntityId, ...(includePending ? {} : PUBLISHED_WHERE) };
  const [birth, citizenships, residences, selfIdentifications] = await Promise.all([
    db.birthOriginFact.findMany({ where, orderBy: [{ evidenceGrade: "asc" }, { updatedAt: "desc" }] }),
    db.citizenshipFact.findMany({ where, orderBy: [{ status: "asc" }, { acquiredYear: "desc" }] }),
    db.residenceFact.findMany({ where, orderBy: [{ startDate: "asc" }, { isCurrent: "desc" }] }),
    db.selfIdentificationFact.findMany({ where, orderBy: [{ publicationDate: "desc" }] }),
  ]);
  return {
    birthCountry: birth.find((b) => b.factKind === "BIRTH_COUNTRY") ?? null,
    birthPlace: birth.find((b) => b.factKind === "BIRTH_PLACE") ?? null,
    citizenships,
    residences,
    selfIdentifications,
  };
}

export interface PersonMediaMentionRow {
  id: string;
  expression: string;
  termCategory: string;
  context: string | null;
  inHeadline: boolean;
  confidence: number;
  publishedAt: Date | null;
  reviewStatus: string;
  article: { id: string; title: string; canonicalUrl: string; genre: string | null } | null;
  mediaOutletEntity: { id: string; canonicalName: string } | null;
  journalistEntity: { id: string; canonicalName: string } | null;
}

export async function getPersonMediaMentions(personEntityId: string, limit = 200): Promise<PersonMediaMentionRow[]> {
  const rows = await db.mediaIdentityMention.findMany({
    where: { personEntityId, reviewStatus: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      expression: true,
      termCategory: true,
      context: true,
      inHeadline: true,
      confidence: true,
      publishedAt: true,
      reviewStatus: true,
      article: { select: { id: true, title: true, canonicalUrl: true, genre: true } },
      mediaOutletEntity: { select: { id: true, canonicalName: true } },
      journalistEntity: { select: { id: true, canonicalName: true } },
    },
  });
  return rows;
}

/** Facts for a batch of persons (used by aggregates). Keyed by personEntityId. */
export async function getPersonsIdentityFactsMap(personEntityIds: string[]): Promise<Map<string, PersonIdentityFacts>> {
  const map = new Map<string, PersonIdentityFacts>();
  if (personEntityIds.length === 0) return map;
  const [birth, citizenships, residences, selfIds] = await Promise.all([
    db.birthOriginFact.findMany({ where: { personEntityId: { in: personEntityIds }, ...PUBLISHED_WHERE } }),
    db.citizenshipFact.findMany({ where: { personEntityId: { in: personEntityIds }, ...PUBLISHED_WHERE } }),
    db.residenceFact.findMany({ where: { personEntityId: { in: personEntityIds }, ...PUBLISHED_WHERE } }),
    db.selfIdentificationFact.findMany({ where: { personEntityId: { in: personEntityIds }, ...PUBLISHED_WHERE } }),
  ]);
  for (const id of personEntityIds) {
    map.set(id, { birthCountry: null, birthPlace: null, citizenships: [], residences: [], selfIdentifications: [] });
  }
  for (const b of birth) {
    const cur = map.get(b.personEntityId);
    if (!cur) continue;
    if (b.factKind === "BIRTH_COUNTRY" && !cur.birthCountry) cur.birthCountry = b;
    if (b.factKind === "BIRTH_PLACE" && !cur.birthPlace) cur.birthPlace = b;
  }
  for (const c of citizenships) map.get(c.personEntityId)?.citizenships.push(c);
  for (const r of residences) map.get(r.personEntityId)?.residences.push(r);
  for (const s of selfIds) map.get(s.personEntityId)?.selfIdentifications.push(s);
  return map;
}