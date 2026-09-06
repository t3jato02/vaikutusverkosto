// Entity resolution — never merge purely on similar names.
// Resolution priority:
//   1. External identifier (provider + identifier)   → DETERMINISTIC
//   2. Business ID (Y-tunnus)                         → DETERMINISTIC
//   3. Exactly ONE exact canonical-name + type match → PROBABLE
//      (multiple matches → UNRESOLVED: parked for human review, never guessed)
//   4. Create a new entity (never auto-merge)
//
// Concurrency: two runs can race a create of the same strong identity. Any
// P2002 is recovered by re-resolving once — the winning row exists by then.

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { EntityRef } from "./types";
import { classifyEntityCategory } from "@/lib/entityCategory";

export type MatchType = "DETERMINISTIC" | "PROBABLE";

export type ResolveOutcome =
  | { status: "matched"; entityId: string; created: boolean; matchType: MatchType }
  | { status: "unresolved"; candidateId: string; candidates: string[] }
  | { status: "rejected"; reason: string };

export async function resolveEntity(db: PrismaClient, ref: EntityRef): Promise<ResolveOutcome> {
  try {
    return await resolveEntityOnce(db, ref);
  } catch (e) {
    // Concurrent create of the same strong identity — re-resolve once.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return resolveEntityOnce(db, ref);
    }
    throw e;
  }
}

async function resolveEntityOnce(db: PrismaClient, ref: EntityRef): Promise<ResolveOutcome> {
  const name = ref.name.trim();
  if (!name) return { status: "rejected", reason: "empty name" };

  const hasExternalId = Boolean(ref.externalId?.provider && ref.externalId.identifier);
  const hasBusinessId = Boolean(ref.businessId);

  // 1. Strong external identifier → deterministic.
  if (hasExternalId) {
    const found = await db.externalIdentifier.findUnique({
      where: {
        provider_identifier: { provider: ref.externalId!.provider, identifier: ref.externalId!.identifier },
      },
      select: { entityId: true },
    });
    if (found) return { status: "matched", entityId: found.entityId, created: false, matchType: "DETERMINISTIC" };
    // A strong, not-yet-known external ID is a NEW identity. Name-based
    // fallback is intentionally skipped (P9: don't merge same-named people).
    return createEntity(db, ref, name);
  }

  // 2. Business ID (Y-tunnus) → deterministic.
  if (hasBusinessId) {
    const clean = ref.businessId!.replace(/\s+/g, "");
    const found = await db.externalIdentifier.findUnique({
      where: { provider_identifier: { provider: "ytj", identifier: clean } },
      select: { entityId: true },
    });
    if (found) return { status: "matched", entityId: found.entityId, created: false, matchType: "DETERMINISTIC" };
    return createEntity(db, ref, name, { businessId: clean });
  }

  // 3. Exact canonical-name match — only when NO strong identifier is present.
  const candidates = await db.entity.findMany({
    where: {
      canonicalName: { equals: name, mode: "insensitive" },
      type: ref.type,
      ...(ref.jurisdiction ? { jurisdiction: ref.jurisdiction } : {}),
    },
    select: { id: true },
  });
  if (candidates.length === 1) {
    return { status: "matched", entityId: candidates[0].id, created: false, matchType: "PROBABLE" };
  }
  if (candidates.length > 1) {
    // Do not guess. Park for human review (dedupe by ref + candidate set).
    const candidateIds = candidates.map((c) => c.id).sort();
    const existing = await db.entityResolutionCandidate.findFirst({
      where: {
        status: "PENDING",
        refName: name,
        refType: ref.type,
        candidateEntityIds: { hasEvery: candidateIds },
      },
      select: { id: true },
    });
    const row =
      existing ??
      (await db.entityResolutionCandidate.create({
        data: {
          refName: name,
          refType: ref.type,
          refJurisdiction: ref.jurisdiction ?? null,
          refExternalProvider: ref.externalId?.provider ?? null,
          refExternalIdentifier: ref.externalId?.identifier ?? null,
          candidateEntityIds: candidateIds,
          context: ref as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      }));
    return { status: "unresolved", candidateId: row.id, candidates: candidateIds };
  }

  // 4. Create a new entity (never auto-merge).
  return createEntity(db, ref, name);
}

async function createEntity(
  db: PrismaClient,
  ref: EntityRef,
  name: string,
  resolvedBusinessId?: { businessId: string },
): Promise<ResolveOutcome> {
  const strongId =
    ref.externalId?.provider && ref.externalId.identifier
      ? { provider: ref.externalId.provider, identifier: ref.externalId.identifier }
      : resolvedBusinessId
        ? { provider: "ytj", identifier: resolvedBusinessId.businessId }
        : null;

  const created = await db.entity.create({
    data: {
      type: ref.type,
      canonicalName: name,
      subtype: ref.subtype ?? undefined,
      jurisdiction: ref.jurisdiction ?? "FI",
      municipality: ref.municipality ?? null,
      country: ref.countryCode === "EU" ? "EU" : "FI",
      countryCode: ref.countryCode ?? (ref.jurisdiction === "EU" ? "EU" : "FI"),
      // Adapter-supplied category wins; otherwise a deterministic name-rule
      // classification (never an LLM guess), left null when nothing fires.
      entityCategory:
        ref.entityCategory ??
        (ref.type !== "PERSON"
          ? (classifyEntityCategory({ name, countryCode: ref.countryCode, jurisdiction: ref.jurisdiction }) ?? undefined)
          : undefined),
      description: ref.description ?? null,
      confidence: "HIGH",
      sourceCount: 1,
      aliases:
        ref.alias && ref.alias !== name
          ? { create: [{ name: ref.alias, aliasType: "NAME_VARIANT" }] }
          : undefined,
      externalIds: strongId ? { create: strongId } : undefined,
    },
  });
  return { status: "matched", entityId: created.id, created: true, matchType: "DETERMINISTIC" };
}
