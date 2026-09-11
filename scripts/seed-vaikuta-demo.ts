// VAIKUTA demo seed — an unmistakably fictional demonstration decision.
//
// Rule (section 25): Do not fabricate a Finnish political controversy. If real
// decision data isn't available locally, create a clearly fictional fixture.
// The fixture decision is titled "TEST — ... (demo)" and every demo row links
// to a non-resolving demo source. Recipients are REAL, source-backed people
// (committee members from the Eduskunta open-data graph) so the recipient
// intelligence demo never fabricates people — only the decision being worked on
// is a test fixture.
//
// Idempotent: rerunning updates instead of duplicating.
//
// Refuses to run in production (like seed-demo.ts): fictional data must never
// reach the live dataset.

import { PrismaClient, EntityType, RelationshipType, SourceType, Confidence, VoteChoice } from "@prisma/client";
import { hashPassword } from "../src/lib/vaikuta/authUser";
import { ensurePlans } from "../src/lib/vaikuta/campaigns";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  console.error("REFUSED: VAIKUTA demo seed cannot run in a production environment.");
  process.exit(1);
}

const DEMO_URL = "https://demo.vaikutusverkosto.fi/paatos/digitaalisen-infrastruktuurin-rahoitus";
const DEMO_SOURCE_NAME = "DEMO-lähde (fiktiivinen)";
const DEMO_TITLE = "TEST — Esimerkkipäätös: Digitaalisen julkisen infrastruktuurin rahoitus (demo)";
const COMMITTEE_NAME = "Valtiovarainvaliokunta";
const DEMO_USER_EMAIL = "demo@vaikuta.fi";
const DEMO_USER_PASSWORD = "VAIKUTA-demo-2026";

async function main() {
  // 1. Demo source (idempotent)
  const source = await prisma.source.upsert({
    where: { sourceUrl: DEMO_URL },
    update: {},
    create: {
      sourceUrl: DEMO_URL,
      sourceName: DEMO_SOURCE_NAME,
      publisher: "Vaikutusverkosto (demo)",
      sourceType: SourceType.OTHER,
      confidence: Confidence.MEDIUM,
      documentTitle: "Demonstraatio: TEST-päätös ja sen lähdepohjaiset vastaanottajat",
      status: "ACTIVE",
    },
  });

  // 2. The demo decision + matching DECISION entity (shared UUID) so ordinary
  //    Relationship edges (authorship) keep working and URLs resolve.
  const committee = await prisma.entity.findFirst({
    where: { subtype: "parliament_committee", canonicalName: COMMITTEE_NAME },
  });
  if (!committee) {
    throw new Error(`${COMMITTEE_NAME} not found — run the parliament ingest first (npm run ingest:parliament).`);
  }

  const existingDecision = await prisma.decision.findFirst({ where: { title: DEMO_TITLE } });
  const decisionId = existingDecision?.id ?? crypto.randomUUID();

  // DECISION entity mirror FIRST (Decision.entityId has an FK to Entity).
  await prisma.entity.upsert({
    where: { id: decisionId },
    update: { canonicalName: DEMO_TITLE, type: EntityType.DECISION, description: "DEMO: TEST-päätöksen entiteettipeili." },
    create: {
      id: decisionId,
      type: EntityType.DECISION,
      canonicalName: DEMO_TITLE,
      description: "DEMO: TEST-päätöksen entiteettipeili.",
      jurisdiction: "FI",
      confidence: Confidence.MEDIUM,
      sourceCount: 1,
    },
  });

  const decision = await prisma.decision.upsert({
    where: { id: decisionId },
    update: {
      title: DEMO_TITLE,
      institutionEntityId: committee.id,
      decisionType: "Esitys",
      description:
        "TEST-aineisto (demo): kuvitteellinen esitys julkisen digitaalisen infrastruktuurin rahoituksesta, " +
        "jota käytetään Vaikuta-työnkulun demonstrointiin. Ei ole todellinen lakiesitys. Vastaanottajat " +
        "ovat kuitenkin todellisia, lähdepohjaisia eduskunnan toimijoita.",
      legalBasis: "TEST: kuvitteellinen oikeusperusta (demo)",
      financialValue: 0,
      currency: "EUR",
      affectedSectors: ["digitaalinen infrastruktuuri", "rahoitus", "julkinen sektori"],
      affectedRegions: ["FI"],
      decisionDate: new Date("2026-08-01"),
      sourceId: source.id,
      confidence: Confidence.MEDIUM,
      entityId: decisionId,
    },
    create: {
      id: decisionId,
      title: DEMO_TITLE,
      institutionEntityId: committee.id,
      decisionType: "Esitys",
      description:
        "TEST-aineisto (demo): kuvitteellinen esitys julkisen digitaalisen infrastruktuurin rahoituksesta, " +
        "jota käytetään Vaikuta-työnkulun demonstrointiin. Ei ole todellinen lakiesitys. Vastaanottajat " +
        "ovat kuitenkin todellisia, lähdepohjaisia eduskunnan toimijoita.",
      legalBasis: "TEST: kuvitteellinen oikeusperusta (demo)",
      financialValue: 0,
      currency: "EUR",
      affectedSectors: ["digitaalinen infrastruktuuri", "rahoitus", "julkinen sektori"],
      affectedRegions: ["FI"],
      decisionDate: new Date("2026-08-01"),
      sourceId: source.id,
      confidence: Confidence.MEDIUM,
      entityId: decisionId,
    },
  });

  console.log(`  + päätös: ${decision.title} (${decision.id})`);

  // 3. Decision stages (timeline) — next opportunity is explicit and marked.
  const stages = [
    { stageType: "INTRODUCED", label: "Ehdotus annettu", date: "2026-08-01", sortOrder: 1 },
    { stageType: "COMMITTEE_CONSIDERATION", label: "Valiokuntakäsittely", date: "2026-08-20", sortOrder: 2 },
    { stageType: "HEARINGS", label: "Asiantuntijakuulemiset", date: null, sortOrder: 3 },
    { stageType: "NEXT_OPPORTUNITY", label: "Valiokunnan käsittelyn jatko", date: "2026-09-15", sortOrder: 4, detail: "TESToitu: seurattava vaikuttamiskohta (demo)." },
  ];
  for (const s of stages) {
    const existing = await prisma.decisionStage.findFirst({ where: { decisionId, stageType: s.stageType, label: s.label } });
    if (existing) continue;
    await prisma.decisionStage.create({
      data: { decisionId, stageType: s.stageType, label: s.label, date: s.date ? new Date(s.date) : null, detail: s.detail ?? null, sourceId: source.id, sortOrder: s.sortOrder },
    });
  }

  // 4. Real committee members as voters on the demo decision.
  const members = await prisma.relationship.findMany({
    where: {
      targetEntityId: committee.id,
      relationshipType: { in: [RelationshipType.MEMBER_OF, RelationshipType.CHAIRS] },
      verificationStatus: { in: ["SOURCE_CONFIRMED", "HUMAN_VERIFIED"] },
    },
    include: { sourceEntity: { select: { id: true, type: true } } },
    take: 120,
  });
  const voters = members.filter((m) => m.sourceEntity.type === "PERSON").slice(0, 12);
  const choices: VoteChoice[] = ["FOR", "FOR", "FOR", "AGAINST", "AGAINST", "FOR", "FOR", "AGAINST", "ABSTAIN", "FOR", "AGAINST", "FOR"];
  let v = 0;
  for (const m of voters) {
    await prisma.vote.upsert({
      where: { decisionId_personEntityId: { decisionId, personEntityId: m.sourceEntityId } },
      update: { choice: choices[v % choices.length] },
      create: { decisionId, personEntityId: m.sourceEntityId, choice: choices[v % choices.length] },
    });
    v += 1;
  }
  console.log(`  + ${voters.length} äänestysmerkintää (demo-päätös, oikeita valiokunnan jäseniä)`);

  // 5. Media fixture: article mentioning the committee, authored by real
  //    journalists, clearly a demo fixture.
  const outlet = await prisma.entity.findFirst({ where: { type: "MEDIA_ORGANIZATION", subtype: "MEDIA_OUTLET" } });
  const journalists = await prisma.entity.findMany({
    where: { type: "PERSON", subtype: { in: ["POLITICS_REPORTER", "INVESTIGATIVE_REPORTER", "JOURNALIST"] } },
    take: 2,
  });
  const articleUrl = "https://demo.vaikutusverkosto.fi/media/test-digitaalinen-infra";
  const articleTitle = "TEST-aineisto: Digitaalisen infrastruktuurin rahoitus (demo)";
  const article = await prisma.article.upsert({
    where: { canonicalUrl: articleUrl },
    update: {},
    create: {
      title: articleTitle,
      canonicalUrl: articleUrl,
      publicationName: outlet?.canonicalName ?? "Demo-mediatalo (demo)",
      publisherEntityId: outlet?.id ?? null,
      publishedAt: new Date("2026-08-25"),
      genre: "NEWS",
      sourceId: source.id,
      publicVisible: true,
      excerpt: "DEMO: esimerkkiaineisto media-vastaanottajien demonstroimiseksi.",
    },
  });
  for (const j of journalists) {
    await prisma.articleAuthor.upsert({
      where: { articleId_personEntityId: { articleId: article.id, personEntityId: j.id } },
      update: {},
      create: { articleId: article.id, personEntityId: j.id, authorOrder: 0 },
    });
  }
  await prisma.articleMention.upsert({
    where: { articleId_entityId_mentionRole: { articleId: article.id, entityId: committee.id, mentionRole: "ORGANIZATION" } },
    update: {},
    create: { articleId: article.id, entityId: committee.id, mentionRole: "ORGANIZATION" },
  });
  console.log(`  + media-fixture: ${journalists.length} toimittajaa, demo-artikkeli`);

  // 6. Demo user (verified) for a smooth E2E + manual demo.
  const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
  await prisma.vaikutaUser.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: { passwordHash, emailVerifiedAt: new Date(), identityLevel: "email_verified" },
    create: { email: DEMO_USER_EMAIL, passwordHash, emailVerifiedAt: new Date(), identityLevel: "email_verified" },
  });
  await ensurePlans();
  console.log(`  + demo-käyttäjä: ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);

  console.log("\nVAIKUTA demo-valmis. Kaikki demo-tiedot on merkitty selkeästi (TEST/... demo).");
  console.log(`Päätös: http://localhost:3000/vaikuta/${decisionId}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});