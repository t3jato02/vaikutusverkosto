// Identity-framing pilot seed (luku 21) — npm run ingest:identity.
//
// Seeds the QA corpus for the "Syntymämaa & media-identiteetti" layer:
//   - documented facts (birth origin, citizenship, residence, self-id) with
//     provenance + evidence grade,
//   - QA worksheet articles whose excerpts contain verbatim identity labels,
//   - runs the deterministic classifier and publishes its lexical detections,
//   - computes aggregates and the reverse-case comparison snapshot.
//
// All sources are real public pages (Wikipedia bios). QA-marked; refuses to
// run in production (NODE_ENV=production / VERCEL).

import { PrismaClient } from "@prisma/client";
import { IDENTITY_PILOT_PERSONS } from "./pilot/identity-pilot-data";
import { writeBirthOriginFact, writeCitizenshipFact, writeResidenceFact, writeSelfIdentificationFact } from "../src/lib/analysis/identity/facts";
import { runIdentityFraming } from "../src/lib/analysis/identity/engine";
import { computeAndStoreIdentityAggregate } from "../src/lib/analysis/identity/aggregate";
import { computeAndStoreReverseComparison } from "../src/lib/analysis/identity/reverse";

const db = new PrismaClient();
const ADDED = { entities: 0, articles: 0, facts: 0 };

async function upsertPersonEntity(p: (typeof IDENTITY_PILOT_PERSONS)[number]): Promise<string> {
  const existing = await db.entity.findFirst({ where: { canonicalName: p.canonicalName, type: "PERSON" }, select: { id: true, countryCode: true } });
  if (existing) {
    await db.entity.update({
      where: { id: existing.id },
      data: { countryCode: p.residenceCountryCode ?? existing.countryCode, jurisdiction: "FI" },
    });
    await db.person.upsert({
      where: { entityId: existing.id },
      create: { entityId: existing.id, birthYear: p.birthYear ?? null },
      update: { birthYear: p.birthYear ?? null },
    });
    return existing.id;
  }
  const entity = await db.entity.create({
    data: {
      type: "PERSON",
      canonicalName: p.canonicalName,
      jurisdiction: "FI",
      countryCode: p.residenceCountryCode ?? "FI",
      entityCategory: "OTHER",
      confidence: "HIGH",
      sourceCount: 1,
      description: "QA-pilottihenkilö (syntymämaa & media-identiteetti -kerros). Lähdeperustainen, julkinen henkilö.",
      externalIds: { create: [{ provider: "identity_pilot", identifier: `identity:${p.canonicalName.toLowerCase().replace(/\s+/g, "-")}` }] },
    },
  });
  await db.person.create({ data: { entityId: entity.id, birthYear: p.birthYear ?? null } });
  ADDED.entities += 1;
  return entity.id;
}

async function seedFacts(p: (typeof IDENTITY_PILOT_PERSONS)[number], entityId: string) {
  const note = "QA-pilotti: dokumentoitu julkinen elämäkertatieto. Sanatarkkuus varmistetaan ennen tuotantoa.";
  const createdBy = "identity-pilot";

  const bc = await writeBirthOriginFact({
    personEntityId: entityId,
    factKind: "BIRTH_COUNTRY",
    value: p.birthCountry.code,
    displayValue: p.birthCountry.display,
    sourceUrl: p.birthCountry.sourceUrl,
    sourceName: p.birthCountry.sourceName,
    sourceType: "REPUTABLE_MEDIA",
    publicationDate: p.birthCountry.publicationDate,
    confidence: "HIGH",
    evidenceGrade: "C",
    reviewStatus: "PUBLISHED",
    createdBy,
    note,
  });
  if (bc.ok) ADDED.facts += 1;

  if (p.birthPlace) {
    const bp = await writeBirthOriginFact({
      personEntityId: entityId,
      factKind: "BIRTH_PLACE",
      value: p.birthPlace.name,
      displayValue: p.birthPlace.name,
      sourceUrl: p.birthPlace.sourceUrl,
      sourceName: p.birthPlace.sourceName,
      sourceType: "REPUTABLE_MEDIA",
      confidence: "HIGH",
      evidenceGrade: "C",
      reviewStatus: "PUBLISHED",
      createdBy,
      note,
    });
    if (bp.ok) ADDED.facts += 1;
  }

  for (const c of p.citizenships) {
    const cf = await writeCitizenshipFact({
      personEntityId: entityId,
      countryCode: c.code,
      status: "CURRENT",
      acquiredYear: c.acquiredYear ?? null,
      sourceUrl: c.sourceUrl,
      sourceName: c.sourceName,
      sourceType: "REPUTABLE_MEDIA",
      confidence: "HIGH",
      evidenceGrade: "C",
      reviewStatus: "PUBLISHED",
      createdBy,
      note,
    });
    if (cf.ok) ADDED.facts += 1;
  }

  for (const r of p.residences) {
    const rf = await writeResidenceFact({
      personEntityId: entityId,
      countryCode: r.code,
      municipality: r.municipality,
      isCurrent: r.isCurrent,
      startDate: r.startYear ? new Date(`${r.startYear}-01-01`) : null,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      sourceType: "REPUTABLE_MEDIA",
      confidence: "HIGH",
      evidenceGrade: "C",
      reviewStatus: "PUBLISHED",
      createdBy,
      note,
    });
    if (rf.ok) ADDED.facts += 1;
  }

  if (p.selfIdentification) {
    const s = p.selfIdentification;
    const sf = await writeSelfIdentificationFact({
      personEntityId: entityId,
      identityLabel: s.label,
      verbatimText: s.verbatim,
      language: s.language,
      sourceUrl: s.sourceUrl,
      sourceName: s.sourceName,
      sourceType: "REPUTABLE_MEDIA",
      confidence: "HIGH",
      evidenceGrade: "C",
      reviewStatus: s.review,
      createdBy,
      note: "Henkilön oma julkinen identiteettikuvaus; vaatii ihmisen tarkistuksen.",
    });
    if (sf.ok) ADDED.facts += 1;
  }
}

async function upsertQaArticle(p: (typeof IDENTITY_PILOT_PERSONS)[number], entityId: string): Promise<string | null> {
  const a = p.article;
  const article = await db.article.upsert({
    where: { canonicalUrl: a.canonicalUrl },
    create: {
      title: `${p.canonicalName} — julkinen elämäkerta (QA-pilotti)`,
      canonicalUrl: a.canonicalUrl,
      publicationName: "Wikipedia (QA-pilottikorpus)",
      publishedAt: new Date(a.publishedAt),
      genre: "OTHER",
      excerpt: a.excerpt,
      topics: [p.canonicalName, "identiteetti"],
      analysisVersion: "identity_framing_v1",
      publicVisible: true,
    },
    update: { excerpt: a.excerpt },
  });
  ADDED.articles += 1;

  await db.articleMention.upsert({
    where: { articleId_entityId_mentionRole: { articleId: article.id, entityId, mentionRole: "SUBJECT" } },
    create: { articleId: article.id, entityId, mentionRole: "SUBJECT", headlineMention: true, firstSegment: true },
    update: { headlineMention: true },
  });
  return article.id;
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    console.error("REFUSED: identity-pilot seed cannot run in a production environment.");
    process.exit(1);
  }

  const ids: Record<string, string> = {};
  for (const p of IDENTITY_PILOT_PERSONS) {
    const id = await upsertPersonEntity(p);
    ids[p.canonicalName] = id;
    await seedFacts(p, id);
    await upsertQaArticle(p, id);
  }

  // Run the deterministic classifier over the corpus and publish its detections.
  const run = await runIdentityFraming({
    scope: "CORPUS",
    reviewStatus: "PUBLISHED",
    createdBy: "identity-pilot",
  });

  // Aggregates.
  await computeAndStoreIdentityAggregate({ scope: "CORPUS" });
  for (const p of IDENTITY_PILOT_PERSONS) {
    await computeAndStoreIdentityAggregate({ scope: "PERSON", entityId: ids[p.canonicalName] });
  }
  const outlets = await db.entity.findMany({ where: { type: "MEDIA_ORGANIZATION", subtype: "MEDIA_OUTLET" }, select: { id: true } });
  for (const o of outlets) {
    await computeAndStoreIdentityAggregate({ scope: "OUTLET", entityId: o.id });
  }
  const reverse = await computeAndStoreReverseComparison();

  const mentionCount = await db.mediaIdentityMention.count();
  console.log(
    `Identiteettipilotti valmis: ${ADDED.entities} henkilöä, ${ADDED.articles} QA-juttua, ${ADDED.facts} faktaa. ` +
      `Luokiteltu ${run.articlesScanned} juttua → ${run.mentionsWritten} mainintaa (yhteensä ${mentionCount}). ` +
      `Käänteisvertailu: ${reverse.status} (A=${reverse.sampleSizeA}, B=${reverse.sampleSizeB}, parit=${reverse.matchedPairs}).`,
  );
  console.log(
    "Syntymämaa säilyy syntymämaana, kansalaisuus kansalaisuutena, asuinmaa asuinmaana, median sanavalinta median sanavalintana. Ei nimipäätelmiä.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());