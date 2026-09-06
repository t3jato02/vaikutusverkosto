-- CreateEnum
CREATE TYPE "EvidenceGrade" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "PersonalFactType" AS ENUM ('BIRTH_COUNTRY', 'NATIVE_LANGUAGE', 'WORK_LANGUAGE', 'NATIONALITY', 'MOTHER_TONGUE');

-- CreateEnum
CREATE TYPE "AffiliationType" AS ENUM ('DECLARED_POLITICAL_AFFILIATION', 'DOCUMENTED_POLITICAL_RELATIONSHIP', 'SELF_DESCRIBED_POLITICAL_VIEW');

-- CreateEnum
CREATE TYPE "AffiliationReviewStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MediaOutletType" AS ENUM ('NEWS_PAPER', 'BROADCASTER', 'MAGAZINE', 'ONLINE_MEDIA', 'NEWS_AGENCY', 'PARTY_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "EditorialAffiliationType" AS ENUM ('FORMALLY_PARTY_AFFILIATED', 'HISTORICALLY_PARTY_AFFILIATED', 'INDEPENDENT', 'SELF_DESCRIBED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JournalisticGenre" AS ENUM ('NEWS', 'ANALYSIS', 'COMMENT', 'COLUMN', 'OPINION', 'INVESTIGATIVE', 'INTERVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "MentionRole" AS ENUM ('SUBJECT', 'SOURCE', 'QUOTED_EXPERT', 'ORGANIZATION', 'COUNTRY', 'TOPIC');

-- CreateEnum
CREATE TYPE "AnalysisScope" AS ENUM ('JOURNALIST', 'MEDIA_OUTLET', 'CORPUS', 'TOPIC');

-- CreateEnum
CREATE TYPE "AnalysisKind" AS ENUM ('COVERAGE_METRICS', 'PARTY_COVERAGE', 'PERSON_COVERAGE', 'GENRE_DISTRIBUTION', 'TOPIC_DISTRIBUTION', 'COUNTRY_DISTRIBUTION', 'SOURCE_TYPE_DISTRIBUTION', 'FRAMING_DISTRIBUTION', 'MEDIA_COMPARISON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RelationshipType" ADD VALUE 'WORKS_FOR';
ALTER TYPE "RelationshipType" ADD VALUE 'WORKED_FOR';
ALTER TYPE "RelationshipType" ADD VALUE 'PREVIOUSLY_WORKED_FOR';
ALTER TYPE "RelationshipType" ADD VALUE 'EDITOR_OF';
ALTER TYPE "RelationshipType" ADD VALUE 'EDITOR_IN_CHIEF_OF';
ALTER TYPE "RelationshipType" ADD VALUE 'FOUNDED';
ALTER TYPE "RelationshipType" ADD VALUE 'OWNED_BY';
ALTER TYPE "RelationshipType" ADD VALUE 'PARTIALLY_OWNS';
ALTER TYPE "RelationshipType" ADD VALUE 'PUBLISHES';
ALTER TYPE "RelationshipType" ADD VALUE 'PART_OF_MEDIA_GROUP';
ALTER TYPE "RelationshipType" ADD VALUE 'SISTER_PUBLICATION_OF';
ALTER TYPE "RelationshipType" ADD VALUE 'INTERVIEWED';
ALTER TYPE "RelationshipType" ADD VALUE 'CITED';
ALTER TYPE "RelationshipType" ADD VALUE 'CITED_AS_EXPERT';
ALTER TYPE "RelationshipType" ADD VALUE 'WROTE_ABOUT';
ALTER TYPE "RelationshipType" ADD VALUE 'PERSONAL_RELATIONSHIP';
ALTER TYPE "RelationshipType" ADD VALUE 'POLITICAL_CANDIDATE_FOR';
ALTER TYPE "RelationshipType" ADD VALUE 'WORKED_FOR_PARTY';
ALTER TYPE "RelationshipType" ADD VALUE 'POLITICAL_AIDE_TO';
ALTER TYPE "RelationshipType" ADD VALUE 'RECEIVED_FUNDING_FROM';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "activeYearsFrom" INTEGER,
ADD COLUMN     "activeYearsTo" INTEGER,
ADD COLUMN     "bioUrl" TEXT,
ADD COLUMN     "professionalBio" TEXT,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "topicAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "writtenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PersonalFact" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "factType" "PersonalFactType" NOT NULL,
    "value" TEXT NOT NULL,
    "proficiency" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticalAffiliation" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "affiliationType" "AffiliationType" NOT NULL,
    "partyEntityId" UUID,
    "role" TEXT,
    "description" TEXT NOT NULL,
    "verbatimText" TEXT,
    "selfReported" BOOLEAN NOT NULL DEFAULT false,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "isCurrent" BOOLEAN,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "reviewStatus" "AffiliationReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticalAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaOutlet" (
    "entityId" UUID NOT NULL,
    "websiteUrl" TEXT,
    "mediaOutletType" "MediaOutletType" NOT NULL DEFAULT 'OTHER',
    "foundingYear" INTEGER,
    "countryCode" TEXT,
    "publishLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jsnMember" BOOLEAN NOT NULL DEFAULT false,
    "jsnSourceUrl" TEXT,
    "fundingModel" TEXT,
    "fundingModelSourceUrl" TEXT,
    "editorialAffiliationType" "EditorialAffiliationType" NOT NULL DEFAULT 'UNKNOWN',
    "editorialAffiliationPartyEntityId" UUID,
    "editorialAffiliationSourceUrl" TEXT,

    CONSTRAINT "MediaOutlet_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publicationName" TEXT,
    "publisherEntityId" UUID,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "genre" "JournalisticGenre" NOT NULL DEFAULT 'OTHER',
    "language" TEXT,
    "archivedUrl" TEXT,
    "excerpt" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analysisVersion" TEXT DEFAULT 'journalist_content_v1',
    "sourceId" UUID,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "publicVisible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleAuthor" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "byline" TEXT,
    "authorOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleMention" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "mentionRole" "MentionRole" NOT NULL DEFAULT 'SUBJECT',
    "headlineMention" BOOLEAN NOT NULL DEFAULT false,
    "firstSegment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArticleMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAnalysis" (
    "id" UUID NOT NULL,
    "scope" "AnalysisScope" NOT NULL,
    "scopeEntityId" UUID,
    "scopeHash" TEXT NOT NULL,
    "kind" "AnalysisKind" NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "corpusSize" INTEGER NOT NULL DEFAULT 0,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "politicsArticleCount" INTEGER NOT NULL DEFAULT 0,
    "algorithm" TEXT NOT NULL DEFAULT 'journalist_content_v1',
    "algorithmVersion" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "result" JSONB NOT NULL,
    "summary" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedFromUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ContentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalFact_personEntityId_idx" ON "PersonalFact"("personEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalFact_personEntityId_factType_value_sourceUrl_key" ON "PersonalFact"("personEntityId", "factType", "value", "sourceUrl");

-- CreateIndex
CREATE INDEX "PoliticalAffiliation_personEntityId_idx" ON "PoliticalAffiliation"("personEntityId");

-- CreateIndex
CREATE INDEX "PoliticalAffiliation_partyEntityId_idx" ON "PoliticalAffiliation"("partyEntityId");

-- CreateIndex
CREATE INDEX "PoliticalAffiliation_affiliationType_idx" ON "PoliticalAffiliation"("affiliationType");

-- CreateIndex
CREATE INDEX "PoliticalAffiliation_reviewStatus_idx" ON "PoliticalAffiliation"("reviewStatus");

-- CreateIndex
CREATE INDEX "MediaOutlet_mediaOutletType_idx" ON "MediaOutlet"("mediaOutletType");

-- CreateIndex
CREATE INDEX "MediaOutlet_editorialAffiliationType_idx" ON "MediaOutlet"("editorialAffiliationType");

-- CreateIndex
CREATE UNIQUE INDEX "Article_canonicalUrl_key" ON "Article"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Article_publisherEntityId_idx" ON "Article"("publisherEntityId");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- CreateIndex
CREATE INDEX "Article_genre_idx" ON "Article"("genre");

-- CreateIndex
CREATE UNIQUE INDEX "Article_title_publishedAt_key" ON "Article"("title", "publishedAt");

-- CreateIndex
CREATE INDEX "ArticleAuthor_personEntityId_idx" ON "ArticleAuthor"("personEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleAuthor_articleId_personEntityId_key" ON "ArticleAuthor"("articleId", "personEntityId");

-- CreateIndex
CREATE INDEX "ArticleMention_entityId_idx" ON "ArticleMention"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleMention_articleId_entityId_mentionRole_key" ON "ArticleMention"("articleId", "entityId", "mentionRole");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAnalysis_scopeHash_key" ON "ContentAnalysis"("scopeHash");

-- CreateIndex
CREATE INDEX "ContentAnalysis_scopeEntityId_idx" ON "ContentAnalysis"("scopeEntityId");

-- CreateIndex
CREATE INDEX "ContentAnalysis_scope_kind_idx" ON "ContentAnalysis"("scope", "kind");

-- AddForeignKey
ALTER TABLE "PersonalFact" ADD CONSTRAINT "PersonalFact_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticalAffiliation" ADD CONSTRAINT "PoliticalAffiliation_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticalAffiliation" ADD CONSTRAINT "PoliticalAffiliation_partyEntityId_fkey" FOREIGN KEY ("partyEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaOutlet" ADD CONSTRAINT "MediaOutlet_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_publisherEntityId_fkey" FOREIGN KEY ("publisherEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAuthor" ADD CONSTRAINT "ArticleAuthor_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAuthor" ADD CONSTRAINT "ArticleAuthor_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMention" ADD CONSTRAINT "ArticleMention_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMention" ADD CONSTRAINT "ArticleMention_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
