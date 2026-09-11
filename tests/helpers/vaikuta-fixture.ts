// Shared fixtures for VAIKUTA DB integration tests. Each fixture is isolated
// and cleaned up in afterAll. Files run serially (vitest fileParallelism:
// false) so fixtures never cross-bleed.

import type { PrismaClient } from "@prisma/client";

export interface VaikutaFixture {
  userId: string;
  otherUserId: string;
  sourceId: string;
  committeeId: string;
  personIds: string[];
  journalistId: string;
  decisionId: string;
  decisionEntityId: string;
}

export async function makeVaikutaFixture(db: PrismaClient): Promise<VaikutaFixture> {
  const source = await db.source.create({
    data: {
      sourceUrl: `https://demo.vaikutusverkosto.fi/test/${crypto.randomUUID()}`,
      sourceName: "TEST-lähde (yksikkötesti)",
      publisher: "Vaikutusverkosto (testi)",
      sourceType: "OFFICIAL_PRIMARY",
      confidence: "HIGH",
      status: "ACTIVE",
    },
  });

  const committee = await db.entity.create({
    data: { type: "GOVERNMENT_BODY", subtype: "parliament_committee", canonicalName: `TEStivaliokunta ${crypto.randomUUID().slice(0, 8)}`, confidence: "HIGH", sourceCount: 1 },
  });

  const persons: string[] = [];
  for (let i = 0; i < 14; i++) {
    const e = await db.entity.create({
      data: { type: "PERSON", canonicalName: `TESTI Henkilö ${i} ${crypto.randomUUID().slice(0, 6)}`, confidence: "HIGH", sourceCount: 1 },
    });
    persons.push(e.id);
  }

  // Confirmed, source-backed memberships (chair for the first person).
  for (let i = 0; i < 14; i++) {
    await db.relationship.create({
      data: {
        sourceEntityId: persons[i],
        targetEntityId: committee.id,
        relationshipType: i === 0 ? "CHAIRS" : "MEMBER_OF",
        verificationState: "PUBLISHED",
        verificationStatus: "SOURCE_CONFIRMED",
        confidenceScore: 0.9,
        confidence: "HIGH",
        temporalState: "CURRENT",
        evidence: { create: [{ sourceId: source.id, confidence: "HIGH" }] },
      },
    });
  }

  // Decision + DECISION entity (shared UUID).
  const decisionId = crypto.randomUUID();
  await db.entity.create({
    data: { id: decisionId, type: "DECISION", canonicalName: `TESTI Päätös ${decisionId.slice(0, 6)}` },
  });
  const decision = await db.decision.create({
    data: {
      id: decisionId,
      title: `TESTI Päätös ${decisionId.slice(0, 6)}`,
      institutionEntityId: committee.id,
      sourceId: source.id,
      entityId: decisionId,
      confidence: "HIGH",
    },
  });

  // Votes on the decision (direct decision authority).
  await db.vote.createMany({
    data: [
      { decisionId: decision.id, personEntityId: persons[0], choice: "FOR" },
      { decisionId: decision.id, personEntityId: persons[1], choice: "AGAINST" },
      { decisionId: decision.id, personEntityId: persons[2], choice: "ABSTAIN" },
    ],
  });

  // Journalist + article covering the matter.
  const journalist = await db.entity.create({
    data: { type: "PERSON", subtype: "POLITICS_REPORTER", canonicalName: `TESTI Toimittaja ${crypto.randomUUID().slice(0, 6)}`, confidence: "HIGH" },
  });
  const article = await db.article.create({
    data: {
      title: `TESTI artikkeli ${decisionId.slice(0, 6)}`,
      canonicalUrl: `https://demo.vaikutusverkosto.fi/test/articles/${decisionId}`,
      publishedAt: new Date(),
      genre: "NEWS",
      publicVisible: true,
      sourceId: source.id,
    },
  });
  await db.articleAuthor.create({ data: { articleId: article.id, personEntityId: journalist.id, authorOrder: 0 } });
  await db.articleMention.create({ data: { articleId: article.id, entityId: committee.id, mentionRole: "ORGANIZATION" } });

  const otherUser = await db.vaikutaUser.create({ data: { email: `other-${decisionId}@test.fi`, passwordHash: "x" } });
  const user = await db.vaikutaUser.create({
    data: { email: `user-${decisionId}@test.fi`, passwordHash: "x", emailVerifiedAt: new Date(), identityLevel: "email_verified" },
  });

  return {
    userId: user.id,
    otherUserId: otherUser.id,
    sourceId: source.id,
    committeeId: committee.id,
    personIds: persons,
    journalistId: journalist.id,
    decisionId: decision.id,
    decisionEntityId: decisionId,
  };
}

export async function destroyVaikutaFixture(db: PrismaClient, f: VaikutaFixture): Promise<void> {
  await db.vaikutaCheckoutSession.deleteMany({ where: { userId: { in: [f.userId, f.otherUserId] } } });
  await db.vaikutaSubscription.deleteMany({ where: { userId: { in: [f.userId, f.otherUserId] } } });
  await db.vaikutaPayment.deleteMany({ where: { userId: { in: [f.userId, f.otherUserId] } } });
  await db.vaikutaEvent.deleteMany({ where: { userId: { in: [f.userId, f.otherUserId] } } });
  await db.vaikutaVerificationToken.deleteMany({ where: { userId: { in: [f.userId, f.otherUserId] } } });
  await db.vaikutaUser.deleteMany({ where: { id: { in: [f.userId, f.otherUserId] } } });

  await db.vote.deleteMany({ where: { decisionId: f.decisionId } });
  await db.decisionStage.deleteMany({ where: { decisionId: f.decisionId } });
  // Campaigns cascade recipients/events; checkout sessions set-null their campaign ref.
  await db.influenceCampaign.deleteMany({ where: { decisionId: f.decisionId } });
  await db.decision.deleteMany({ where: { id: f.decisionId } });

  await db.articleMention.deleteMany({ where: { entityId: f.committeeId } });
  await db.articleAuthor.deleteMany({ where: { personEntityId: f.journalistId } });
  await db.article.deleteMany({
    where: { canonicalUrl: { startsWith: "https://demo.vaikutusverkosto.fi/test/articles/" } },
  });

  await db.relationship.deleteMany({ where: { targetEntityId: f.committeeId } });
  await db.entity.deleteMany({ where: { id: { in: [...f.personIds, f.journalistId, f.committeeId, f.decisionEntityId] } } });
  await db.source.deleteMany({ where: { id: f.sourceId } });
}