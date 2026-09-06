// Media & journalism pilot ingestion (section 26).
//
// Kontrolloitu pilotti: mediat, toimittajat, omistussuhteet ja reaaliaikainen
// havaittu julkaisudata (otsikko + canonical URL + ajankohta RSS-syötteistä).
// Kaikki samojen evidence-sääntöjen alaisia: jokaisella suhteella ja jutulla on
// lähde; agentti voi tuottaa vain AUTO_DETECTED/SOURCE_CONFIRMED; E-luokan
// väitteitä ei julkaista julkiseen näkymään.
//
// Aja: npm run ingest:media
// EI aja tuotannossa (NODE_ENV=production / VERCEL) — pilotti on QA-aineistoa.

import { PrismaClient } from "@prisma/client";
import {
  PILOT_COMPANIES,
  PILOT_OUTLETS,
  PILOT_JOURNALISTS,
  PILOT_ARTICLES,
  PARTY_NAME_HINTS,
  type PilotArticle,
} from "./pilot/media-pilot-data";
import { computeAndStoreAnalysis } from "../src/lib/analysis/engine";

const db = new PrismaClient();
const ADDED = { entities: 0, rels: 0, articles: 0, mentions: 0 };

async function upsertSource(url: string, name: string, sourceType: string) {
  const existing = await db.source.findUnique({ where: { sourceUrl: url } });
  if (existing) return existing;
  return db.source.create({
    data: {
      sourceUrl: url,
      sourceName: name,
      sourceType: sourceType as never,
      publisher: url.startsWith("https://") ? new URL(url).hostname : null,
      documentTitle: name,
    },
  });
}

async function upsertEntity(opts: {
  type: string;
  subtype?: string;
  canonicalName: string;
  description?: string;
  countryCode?: string;
  sourceUrl: string;
  sourceName: string;
  externalId?: string;
}) {
  const existing = await db.entity.findFirst({ where: { canonicalName: opts.canonicalName } });
  if (existing) {
    await db.entity.update({
      where: { id: existing.id },
      data: { type: opts.type as never, subtype: opts.subtype ?? existing.subtype },
    });
    return existing.id;
  }
  const entity = await db.entity.create({
    data: {
      type: opts.type as never,
      subtype: opts.subtype,
      canonicalName: opts.canonicalName,
      description: opts.description,
      jurisdiction: "FI",
      countryCode: opts.countryCode ?? "FI",
      entityCategory: opts.type === "MEDIA_ORGANIZATION" ? "MEDIA_ORGANIZATION" : undefined,
      confidence: "HIGH",
      sourceCount: 1,
      externalIds: opts.externalId ? { create: [{ provider: "media_pilot", identifier: opts.externalId }] } : undefined,
    },
  });
  await upsertSource(opts.sourceUrl, opts.sourceName, "REPUTABLE_MEDIA");
  ADDED.entities += 1;
  return entity.id;
}

async function upsertRelationship(rel: {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  sourceUrl: string;
  sourceName: string;
  current?: boolean;
}) {
  const existing = await db.relationship.findFirst({
    where: { sourceEntityId: rel.sourceEntityId, targetEntityId: rel.targetEntityId, relationshipType: rel.relationshipType as never },
  });
  if (existing) return existing;
  const src = await upsertSource(rel.sourceUrl, rel.sourceName, "REPUTABLE_MEDIA");
  const relationship = await db.relationship.create({
    data: {
      sourceEntityId: rel.sourceEntityId,
      targetEntityId: rel.targetEntityId,
      relationshipType: rel.relationshipType as never,
      temporalState: rel.current ? "CURRENT" : "UNKNOWN_PERIOD",
      status: "ACTIVE",
      confidence: "HIGH",
      verificationState: "PUBLISHED",
      verificationStatus: "SOURCE_CONFIRMED",
      createdBy: "media-pilot-agent",
      evidence: {
        create: [{ sourceId: src.id, confidence: "HIGH", quotedFragment: `Lähde (${rel.sourceName}) dokumentoi tämän suhteen.` }],
      },
    },
  });
  ADDED.rels += 1;
  return relationship;
}

// Maininta `havainnoitua tietoa`: tunnistus tehdään otsikon sanatarkasta
// nimestä (word-boundary), joko kantaluettelosta tai puolueen tunnistimesta.
// Ei AI-päätelmiä.
async function resolveMentions(title: string) {
  const [persons, parties] = await Promise.all([
    db.entity.findMany({ where: { type: "PERSON" }, select: { id: true, canonicalName: true, aliases: { select: { name: true } } } }),
    db.entity.findMany({ where: { type: "POLITICAL_PARTY" }, select: { id: true, canonicalName: true } }),
  ]);
  const personIds = new Set<string>();
  const partyIds = new Set<string>();
  const boundary = (word: string) => new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
  const inTitle = (word: string) => boundary(word).test(title);

  const tokenize = (s: string) => s.toLowerCase().split(/[\s-]+/).filter((x) => x.length >= 3);
  const tokensOf = (s: string) => new Set(tokenize(s));

  for (const hintKey of Object.keys(PARTY_NAME_HINTS)) {
    // Distinct Finnish party tokens (>=6 chars) are safe as plain substring
    // matches even inside compounds ("kokoomusministerin"); short keys (PS,
    // SDP, KOK...) use strict word boundaries.
    const plain = hintKey.length >= 6 ? title.toLowerCase().includes(hintKey.toLowerCase()) : inTitle(hintKey);
    if (!plain) continue;
    const targetTokens = tokensOf(PARTY_NAME_HINTS[hintKey]);
    let best: { id: string; score: number } | null = null;
    for (const party of parties) {
      const canonTokens = tokensOf(party.canonicalName);
      let overlap = 0;
      for (const tok of canonTokens) if (targetTokens.has(tok)) overlap += 1;
      if (overlap > (best?.score ?? 0)) best = { id: party.id, score: overlap };
    }
    if (best) partyIds.add(best.id);
  }

  for (const person of persons) {
    const names = [person.canonicalName, ...person.aliases.map((a) => a.name)];
    if (names.some((n) => n.trim().length >= 3 && inTitle(n.trim()))) {
      personIds.add(person.id);
      continue;
    }
    const lastName = person.canonicalName.split(" ").slice(-1)[0];
    if (lastName.length >= 3 && inTitle(lastName)) personIds.add(person.id);
  }

  return { personIds: [...personIds], partyIds: [...partyIds] };
}

async function ingestArticle(a: PilotArticle, outletIds: Record<string, string>, journalistIds: Record<string, string>) {
  const publisherId = outletIds[a.outlet];
  const src = await upsertSource(a.url, `${a.outlet} — ${a.title.slice(0, 80)}`, "REPUTABLE_MEDIA");
  const article = await db.article.upsert({
    where: { canonicalUrl: a.url },
    create: {
      title: a.title,
      canonicalUrl: a.url,
      publicationName: publisherId ? undefined : a.outlet,
      publisherEntity: publisherId ? { connect: { id: publisherId } } : undefined,
      publishedAt: new Date(a.publishedAt),
      genre: a.genre as never,
      topics: a.topics,
      excerpt: a.excerpt ?? null,
      analysisVersion: "journalist_content_v1",
      publicVisible: true,
      source: { connect: { id: src.id } },
    },
    update: { title: a.title },
  });

  for (const slug of a.authors ?? []) {
    const pid = journalistIds[slug];
    if (!pid) continue;
    await db.articleAuthor.upsert({
      where: { articleId_personEntityId: { articleId: article.id, personEntityId: pid } },
      create: { articleId: article.id, personEntityId: pid, authorOrder: 0 },
      update: {},
    });
  }

  const { personIds, partyIds } = await resolveMentions(a.title);
  for (const pid of [...personIds, ...partyIds].slice(0, 12)) {
    try {
      await db.articleMention.upsert({
        where: { articleId_entityId_mentionRole: { articleId: article.id, entityId: pid, mentionRole: "SUBJECT" } },
        create: { articleId: article.id, entityId: pid, mentionRole: "SUBJECT", headlineMention: true, firstSegment: true },
        update: {},
      });
      ADDED.mentions += 1;
    } catch {
      // entity may have vanished between the lookup and the insert — skip
    }
  }
  ADDED.articles += 1;
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    console.error("REFUSED: media-pilot seed cannot run in a production environment.");
    process.exit(1);
  }

  const companyUrls = Object.fromEntries(PILOT_COMPANIES.map((c) => [c.slug, c.url]));
  const companyIds: Record<string, string> = {};
  for (const c of PILOT_COMPANIES) {
    companyIds[c.slug] = await upsertEntity({
      type: "COMPANY",
      subtype: c.subtype,
      canonicalName: c.name,
      description: c.note,
      sourceUrl: c.url,
      sourceName: `${c.name} — virallinen sivusto`,
    });
  }

  const outletIds: Record<string, string> = {};
  for (const o of PILOT_OUTLETS) {
    const id = await upsertEntity({
      type: "MEDIA_ORGANIZATION",
      subtype: "MEDIA_OUTLET",
      canonicalName: o.name,
      description: `${o.name} — ${o.fundingModel ?? "media"}. Pilottikorpus.`,
      countryCode: o.countryCode ?? "FI",
      sourceUrl: o.url,
      sourceName: `${o.name} — virallinen sivusto`,
      externalId: `media:${o.slug}`,
    });
    outletIds[o.slug] = id;
    await db.mediaOutlet.upsert({
      where: { entityId: id },
      create: {
        entityId: id,
        websiteUrl: o.url,
        mediaOutletType: o.outletType as never,
        foundingYear: o.foundingYear,
        countryCode: o.countryCode ?? "FI",
        publishLanguages: o.languages,
        jsnMember: o.jsnMember ?? false,
        jsnSourceUrl: o.jsnMember ? o.url : undefined,
        fundingModel: o.fundingModel,
        editorialAffiliationType: o.editorialAffiliation?.type ?? "UNKNOWN",
        editorialAffiliationSourceUrl: o.editorialAffiliation?.sourceUrl,
      },
      update: { websiteUrl: o.url },
    });
  }

  for (const o of PILOT_OUTLETS) {
    if (!o.ownerSlug || !companyIds[o.ownerSlug]) continue;
    const ownerUrl = companyUrls[o.ownerSlug] ?? o.url;
    await upsertRelationship({
      sourceEntityId: outletIds[o.slug],
      targetEntityId: companyIds[o.ownerSlug],
      relationshipType: "OWNED_BY",
      sourceUrl: ownerUrl,
      sourceName: `${o.name} — omistaja ${o.ownerSlug}`,
      current: true,
    });
  }

  const journalistIds: Record<string, string> = {};
  for (const j of PILOT_JOURNALISTS) {
    const id = await upsertEntity({
      type: "PERSON",
      subtype: j.subtype,
      canonicalName: j.name,
      description: `${j.currentRole}, ${j.specialties.join(", ")}.`,
      sourceUrl: j.sourceUrl,
      sourceName: j.sourceName,
      externalId: `journalist:${j.slug}`,
    });
    journalistIds[j.slug] = id;
    await db.person.upsert({
      where: { entityId: id },
      create: {
        entityId: id,
        firstName: j.name.split(" ")[0],
        lastName: j.name.split(" ").slice(1).join(" "),
        profession: "toimittaja",
        specialties: j.specialties,
        topicAreas: j.topics,
        activeYearsFrom: j.activeYearsFrom,
        bioUrl: j.sourceUrl,
      },
      update: { profession: "toimittaja", specialties: j.specialties, topicAreas: j.topics, activeYearsFrom: j.activeYearsFrom, bioUrl: j.sourceUrl },
    });
    if (outletIds[j.outlet]) {
      await upsertRelationship({
        sourceEntityId: id,
        targetEntityId: outletIds[j.outlet],
        relationshipType: "WORKS_FOR",
        sourceUrl: j.sourceUrl,
        sourceName: j.sourceName,
        current: true,
      });
      const existingPos = await db.position.findFirst({ where: { personEntityId: id, organizationEntityId: outletIds[j.outlet], role: j.currentRole } });
      if (!existingPos) {
        const src = await upsertSource(j.sourceUrl, j.sourceName, "REPUTABLE_MEDIA");
        await db.position.create({
          data: { personEntityId: id, organizationEntityId: outletIds[j.outlet], role: j.currentRole, isCurrent: true, sourceId: src.id },
        });
      }
    }
  }

  for (const a of PILOT_ARTICLES) await ingestArticle(a, outletIds, journalistIds);

  for (const j of Object.values(journalistIds)) {
    await computeAndStoreAnalysis("JOURNALIST", "COVERAGE_METRICS", j);
    await computeAndStoreAnalysis("JOURNALIST", "PARTY_COVERAGE", j);
    await computeAndStoreAnalysis("JOURNALIST", "PERSON_COVERAGE", j);
    await computeAndStoreAnalysis("JOURNALIST", "GENRE_DISTRIBUTION", j);
  }
  for (const o of Object.values(outletIds)) {
    await computeAndStoreAnalysis("MEDIA_OUTLET", "COVERAGE_METRICS", o);
    await computeAndStoreAnalysis("MEDIA_OUTLET", "PARTY_COVERAGE", o);
  }

  console.log(
    `Pilotti valmis: ${ADDED.entities} uutta toimijaa, ${ADDED.rels} suhdetta, ${ADDED.articles} juttua, ${ADDED.mentions} mainintatunnistusta.`,
  );
  console.log("Kaikki tiedot lähdeperustaisia (media-domain). Ei poliittisia kannanpäätelmiä, ei nimipäätelmiä.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());