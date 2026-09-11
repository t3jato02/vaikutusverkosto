// Reconcile duplicate Yle entities into a single canonical entity (data-quality
// audit, section 44). NEVER deletes meaningful data: all foreign-key references
// are re-pointed to the canonical entity, aliases/external ids are merged,
// extension rows are copied where the canonical lacks data, and every merge is
// written to ChangeLog (IDENTITY_MERGED) for audit. Only after re-pointing
// succeeds are the empty duplicate shells removed.
//
// Usage: npm run reconcile:yle  (idempotent — safe to re-run)

import { db } from "../src/lib/db";

const CANONICAL_ID = "0eea76ff-8710-4c2f-9bf2-eb7e659ecd12"; // MEDIA_ORGANIZATION "Yleisradio Oy"
const DUPLICATES = [
  "3b326d2a-b02d-4678-9800-42f1cf5008a3", // MEDIA_ORGANIZATION "Yle" (pilot)
  "1af1d4f2-a2a1-4b1b-978d-4e97fba74ffe", // ORGANIZATION "Yleisradio Oy"
  "324074ce-4c94-437c-b3f8-f3ce9b53e7c5", // COMPANY "Yleisradio Oy"
];

const SCALAR_FK: [string, string][] = [
  // table field — every occurrence of `field` = duplicate id → canonical id
  ["relationship", "sourceEntityId"],
  ["relationship", "targetEntityId"],
  ["financialFlow", "payerEntityId"],
  ["financialFlow", "recipientEntityId"],
  ["financialFlow", "intermediaryEntityId"],
  ["financialFlow", "ultimateBeneficiaryEntityId"],
  ["position", "personEntityId"],
  ["position", "organizationEntityId"],
  ["evidence", "entityId"],
  ["article", "publisherEntityId"],
  ["articleAuthor", "personEntityId"],
  ["articleMention", "entityId"],
  ["mediaIdentityMention", "personEntityId"],
  ["mediaIdentityMention", "mediaOutletEntityId"],
  ["mediaIdentityMention", "journalistEntityId"],
  ["personalFact", "personEntityId"],
  ["politicalAffiliation", "personEntityId"],
  ["politicalAffiliation", "partyEntityId"],
  ["birthOriginFact", "personEntityId"],
  ["citizenshipFact", "personEntityId"],
  ["residenceFact", "personEntityId"],
  ["selfIdentificationFact", "personEntityId"],
  ["decision", "institutionEntityId"],
  ["decision", "entityId"],
  ["vote", "personEntityId"],
  ["event", "entityId"],
  ["benefitEvent", "recipientEntityId"],
  ["benefitEvent", "giverEntityId"],
  ["benefitEvent", "payerEntityId"],
  ["benefitEvent", "beneficiaryEntityId"],
  ["benefitEvent", "subjectEntityId"],
  ["benefitEvent", "artistEntityId"],
  ["financialStatementItem", "entityId"],
  ["entityResolutionCandidate", "resolvedEntityId"],
  ["relationshipCandidate", "resolvedSourceEntityId"],
  ["relationshipCandidate", "resolvedTargetEntityId"],
  ["verificationQueue", "entityId"],
  ["changeLog", "entityId"],
  ["correction", "entityId"],
  ["campaignRecipient", "entityId"],
  ["vaikutaContactMethod", "entityId"],
  ["influenceCampaign", "userId"], // no-op safeguard, userId never matches
];

const ARRAY_FK: [string, string][] = [
  ["entityResolutionCandidate", "candidateEntityIds"],
];

// Table facade so dynamic-table re-pointing stays type-safe (no `any`).
type WhereClause = Record<string, unknown>;
interface TableLike {
  updateMany(args: { where: WhereClause; data: WhereClause }): Promise<{ count: number }>;
  findMany(args: { where: WhereClause; select?: WhereClause }): Promise<Record<string, unknown>[]>;
  update(args: { where: { id: string }; data: WhereClause }): Promise<unknown>;
  count(args: { where: WhereClause }): Promise<number>;
  findUnique(args: { where: WhereClause }): Promise<Record<string, unknown> | null>;
}
const client = db as unknown as Record<string, TableLike>;

async function repoint() {
  for (const dup of DUPLICATES) {
    for (const [table, field] of SCALAR_FK) {
      try {
        const res = await client[table].updateMany({ where: { [field]: dup }, data: { [field]: CANONICAL_ID } });
        if (res.count > 0) console.log(`  ${table}.${field}: ${res.count} row(s) re-pointed`);
      } catch (e) {
        console.log(`  !! ${table}.${field}: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    for (const [table, field] of ARRAY_FK) {
      const rows = await client[table].findMany({ where: { [field]: { has: dup } }, select: { id: true, [field]: true } });
      for (const r of rows) {
        const ids = r[field] as string[];
        const next = ids.map((x: string) => (x === dup ? CANONICAL_ID : x));
        await client[table].update({ where: { id: r.id as string }, data: { [field]: next } });
      }
      if (rows.length) console.log(`  ${table}.${field}: ${rows.length} row(s) re-pointed`);
    }
  }
}

async function mergeMeta() {
  for (const dup of DUPLICATES) {
    const aliases = await db.entityAlias.findMany({ where: { entityId: dup } });
    for (const a of aliases) {
      await db.entityAlias.upsert({
        where: { entityId_name_aliasType: { entityId: CANONICAL_ID, name: a.name, aliasType: a.aliasType } },
        update: {},
        create: { entityId: CANONICAL_ID, name: a.name, aliasType: a.aliasType, language: a.language },
      });
    }
    const extIds = await db.externalIdentifier.findMany({ where: { entityId: dup } });
    for (const e of extIds) {
      await db.externalIdentifier.upsert({
        where: { provider_identifier: { provider: e.provider, identifier: e.identifier } },
        update: {},
        create: { entityId: CANONICAL_ID, provider: e.provider, identifier: e.identifier },
      });
    }
    // Copy extension rows (organization / mediaOutlet / person) where the
    // canonical has no data for a field.
    const org = await db.organization.findUnique({ where: { entityId: dup } });
    if (org) {
      const target = await db.organization.findUnique({ where: { entityId: CANONICAL_ID } });
      await db.organization.upsert({
        where: { entityId: CANONICAL_ID },
        update: {
          ...(target?.legalForm ?? org.legalForm ? { legalForm: org.legalForm ?? target?.legalForm } : {}),
          ...(target?.registrationNumber ?? org.registrationNumber ? { registrationNumber: org.registrationNumber ?? target?.registrationNumber } : {}),
          ...(target?.foundingYear ?? org.foundingYear ? { foundingYear: org.foundingYear ?? target?.foundingYear } : {}),
          ...(target?.headquarters ?? org.headquarters ? { headquarters: org.headquarters ?? target?.headquarters } : {}),
          ...(target?.employeeCount ?? org.employeeCount ? { employeeCount: org.employeeCount ?? target?.employeeCount } : {}),
        },
        create: {
          entityId: CANONICAL_ID,
          legalForm: org.legalForm,
          registrationNumber: org.registrationNumber,
          foundingYear: org.foundingYear,
          headquarters: org.headquarters,
          employeeCount: org.employeeCount,
        },
      });
    }
    const mo = await db.mediaOutlet.findUnique({ where: { entityId: dup } });
    if (mo) {
      const target = await db.mediaOutlet.findUnique({ where: { entityId: CANONICAL_ID } });
      await db.mediaOutlet.upsert({
        where: { entityId: CANONICAL_ID },
        update: {
          ...(target?.websiteUrl ?? mo.websiteUrl ? { websiteUrl: mo.websiteUrl ?? target?.websiteUrl } : {}),
          ...(target?.mediaOutletType !== "OTHER" ? {} : { mediaOutletType: mo.mediaOutletType }),
          ...(target?.publishLanguages.length ? {} : { publishLanguages: mo.publishLanguages }),
          ...(target?.fundingModel ?? mo.fundingModel ? { fundingModel: mo.fundingModel ?? target?.fundingModel } : {}),
          ...(target?.foundingYear ?? mo.foundingYear ? { foundingYear: mo.foundingYear ?? target?.foundingYear } : {}),
        },
        create: {
          entityId: CANONICAL_ID,
          websiteUrl: mo.websiteUrl,
          mediaOutletType: mo.mediaOutletType,
          publishLanguages: mo.publishLanguages,
          fundingModel: mo.fundingModel,
          foundingYear: mo.foundingYear,
          countryCode: mo.countryCode,
        },
      });
    }
  }
}

async function removeDuplicates() {
  for (const dup of DUPLICATES) {
    const remaining = await db.relationship.count({
      where: { OR: [{ sourceEntityId: dup }, { targetEntityId: dup }] },
    });
    const flows = await db.financialFlow.count({ where: { OR: [{ payerEntityId: dup }, { recipientEntityId: dup }] } });
    if (remaining > 0 || flows > 0) {
      console.log(`  !! ${dup} still has ${remaining} rels / ${flows} flows — NOT removed`);
      continue;
    }
    const name = (await db.entity.findUnique({ where: { id: dup }, select: { canonicalName: true } }))?.canonicalName ?? "?";
    await db.entity.delete({ where: { id: dup } });
    await db.changeLog.create({
      data: {
        eventType: "IDENTITY_MERGED",
        entityId: CANONICAL_ID,
        description: `Identiteetit yhdistetty: "${name}" (${dup}) → Yleisradio Oy (käännelty, ei dataa poistettu)`,
        beforeData: { duplicateId: dup },
        afterData: { canonicalId: CANONICAL_ID },
      },
    });
    console.log(`  merged & removed duplicate ${name} (${dup})`);
  }
}

async function main() {
  console.log("Re-pointing foreign keys…");
  await repoint();
  console.log("Merging aliases / external ids / extension rows…");
  await mergeMeta();
  console.log("Removing empty duplicate shells…");
  await removeDuplicates();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());