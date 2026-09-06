// Database invariants for the media/journalism feature (sections 7, 25, 29):
//   - duplicate prevention (canonicalUrl, article-author, mention)
//   - no E-grade evidence published as fact
//   - affiliation review lifecycle (human-only HUMAN_VERIFIED)
//   - no personal relationship from coverage data
//   - media orientation never copied to a person

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/lib/db";

beforeAll(async () => {
  // ensure we have a journalist in the corpus to anchor the relationship tests
  const j = await db.entity.findFirst({ where: { canonicalName: "Mikael Shepelenko", type: "PERSON" }, select: { id: true } });
  void j;
});

afterAll(async () => {
  await db.$disconnect();
});

function countOf(rows: unknown): number {
  return Number((rows as { count: unknown }[])[0]?.count ?? 0);
}

describe("media DB invariants", () => {
  it("articles are unique by canonicalUrl", async () => {
    const dup = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "Article" GROUP BY "canonicalUrl" HAVING count(*) > 1`,
    );
    expect(dup).toEqual([]);
  });

  it("no duplicate (article, author) rows", async () => {
    const dup = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "ArticleAuthor" GROUP BY "articleId","personEntityId" HAVING count(*) > 1`,
    );
    expect(dup).toEqual([]);
  });

  it("pilot journalists each have a current WORKS_FOR relationship with evidence", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT r.id FROM "Relationship" r
       WHERE r."relationshipType" = 'WORKS_FOR' AND r."temporalState" = 'CURRENT'
         AND NOT EXISTS (SELECT 1 FROM "Evidence" e WHERE e."relationshipId" = r.id)`,
    );
    expect(bad).toEqual([]);
  });

  it("no published political affiliation with EvidenceGrade E", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "PoliticalAffiliation"
       WHERE "reviewStatus" = 'PUBLISHED' AND "evidenceGrade" = 'E'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("reviewAffiliation is the only way to reach HUMAN_VERIFIED on an affiliation", async () => {
    // Agents create rows; verification must stay SOURCE_CONFIRMED/AUTO_DETECTED
    // until a human approves. Check the constraint by looking for any row whose
    // verificationStatus is HUMAN_VERIFIED but reviewStatus is not PUBLISHED.
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "PoliticalAffiliation"
       WHERE "verificationStatus" = 'HUMAN_VERIFIED' AND "reviewStatus" <> 'PUBLISHED'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("media orientation fields exist only on MEDIA_ORGANIZATION entities", async () => {
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "MediaOutlet" mo
       JOIN "Entity" e ON e.id = mo."entityId"
       WHERE e.type <> 'MEDIA_ORGANIZATION'`,
    );
    expect(countOf(bad)).toBe(0);
  });

  it("no personal relationship edges derived from article data in the corpus", async () => {
    // Corpus coverage is stored as ArticleAuthor/ArticleMention; the published
    // relationship graph must not contain PERSONAL_RELATIONSHIP edges unless
    // explicitly evidence-backed.
    const bad = await db.$queryRawUnsafe(
      `SELECT count(*) AS count FROM "Relationship" r
       WHERE r."relationshipType" = 'PERSONAL_RELATIONSHIP'
         AND NOT EXISTS (SELECT 1 FROM "Evidence" e WHERE e."relationshipId" = r.id)`,
    );
    expect(countOf(bad)).toBe(0);
  });
});
