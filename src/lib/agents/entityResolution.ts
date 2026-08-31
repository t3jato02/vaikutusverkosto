// Entity resolution — never merge purely on similar names.
// Resolution priority:
//   1. External identifier (provider + identifier), e.g. eduskunta-heteka, ytj
//   2. Business ID (Y-tunnus) via ExternalIdentifier(provider='ytj')
//   3. Exact canonical name + type (+ jurisdiction/municipality when present)
//      → only if exactly ONE candidate; if multiple → ambiguous (rejected)
//   4. Create new entity (never auto-merge).

import type { PrismaClient } from "@prisma/client";
import type { EntityRef } from "./types";

export type ResolveOutcome =
  | { status: "matched"; entityId: string; created: boolean }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "rejected"; reason: string };

export async function resolveEntity(db: PrismaClient, ref: EntityRef): Promise<ResolveOutcome> {
  const name = ref.name.trim();
  if (!name) return { status: "rejected", reason: "empty name" };

  const hasExternalId = Boolean(ref.externalId?.provider && ref.externalId.identifier);
  const hasBusinessId = Boolean(ref.businessId);

  // 1. Strong external identifier
  if (hasExternalId) {
    const found = await db.externalIdentifier.findUnique({
      where: {
        provider_identifier: {
          provider: ref.externalId!.provider,
          identifier: ref.externalId!.identifier,
        },
      },
      select: { entityId: true },
    });
    if (found) return { status: "matched", entityId: found.entityId, created: false };
    // A strong, not-yet-known external ID is a NEW identity.
    // Name-based fallback is intentionally SKIPPED to avoid merging distinct people
    // who happen to share a name (P9).
    return createEntity(db, ref, name);
  }

  // 2. Business ID (Y-tunnus)
  if (hasBusinessId) {
    const clean = ref.businessId!.replace(/\s+/g, "");
    const found = await db.externalIdentifier.findUnique({
      where: { provider_identifier: { provider: "ytj", identifier: clean } },
      select: { entityId: true },
    });
    if (found) return { status: "matched", entityId: found.entityId, created: false };
    return createEntity(db, ref, name, { businessId: clean });
  }

  // 3. Exact name match only when NO strong identifier is provided.
  const candidates = await db.entity.findMany({
    where: {
      canonicalName: { equals: name, mode: "insensitive" },
      type: ref.type,
      ...(ref.jurisdiction ? { jurisdiction: ref.jurisdiction } : {}),
    },
    select: { id: true },
  });
  if (candidates.length === 1) {
    return { status: "matched", entityId: candidates[0].id, created: false };
  }
  if (candidates.length > 1) {
    return { status: "ambiguous", candidates: candidates.map((c) => c.id) };
  }

  // 4. Create new entity (never auto-merge).
  return createEntity(db, ref, name);
}

async function createEntity(
  db: PrismaClient,
  ref: EntityRef,
  name: string,
  resolvedBusinessId?: { businessId: string },
): Promise<ResolveOutcome> {
  const created = await db.entity.create({
    data: {
      type: ref.type,
      canonicalName: name,
      subtype: ref.subtype ?? undefined,
      jurisdiction: ref.jurisdiction ?? "FI",
      municipality: ref.municipality ?? null,
      country: "FI",
      description: ref.description ?? null,
      confidence: "HIGH",
      sourceCount: 1,
      aliases: ref.alias && ref.alias !== name ? { create: [{ name: ref.alias, aliasType: "NAME_VARIANT" }] } : undefined,
      externalIds:
        ref.externalId?.provider && ref.externalId.identifier
          ? { create: { provider: ref.externalId.provider, identifier: ref.externalId.identifier } }
          : resolvedBusinessId
            ? { create: { provider: "ytj", identifier: resolvedBusinessId.businessId } }
            : undefined,
    },
  });
  return { status: "matched", entityId: created.id, created: true };
}