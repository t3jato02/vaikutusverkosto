-- CreateEnum
CREATE TYPE "OriginFactKind" AS ENUM ('BIRTH_COUNTRY', 'BIRTH_PLACE');

-- CreateEnum
CREATE TYPE "CitizenshipStatus" AS ENUM ('CURRENT', 'FORMER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IdentityReviewStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MediaIdentityTermCategory" AS ENUM ('NATIONALITY', 'CITIZENSHIP', 'RESIDENCE', 'PLACE_OF_BIRTH', 'IMMIGRATION_STATUS', 'CITY_IDENTITY', 'REGION_IDENTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IdentityAggregateScope" AS ENUM ('OUTLET', 'JOURNALIST', 'CORPUS', 'TERM', 'PERSON');

-- CreateTable
CREATE TABLE "BirthOriginFact" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "factKind" "OriginFactKind" NOT NULL,
    "value" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "reviewStatus" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthOriginFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenshipFact" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "status" "CitizenshipStatus" NOT NULL DEFAULT 'CURRENT',
    "acquiredYear" INTEGER,
    "endedYear" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "reviewStatus" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenshipFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidenceFact" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "countryCode" TEXT,
    "countryName" TEXT,
    "municipality" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "reviewStatus" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidenceFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfIdentificationFact" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "identityLabel" TEXT NOT NULL,
    "verbatimText" TEXT NOT NULL,
    "language" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "reviewStatus" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfIdentificationFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaIdentityMention" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "expression" TEXT NOT NULL,
    "expressionNormalized" TEXT NOT NULL,
    "termCategory" "MediaIdentityTermCategory" NOT NULL,
    "context" TEXT,
    "inHeadline" BOOLEAN NOT NULL DEFAULT false,
    "mediaOutletEntityId" UUID,
    "journalistEntityId" UUID,
    "publishedAt" TIMESTAMP(3),
    "genre" TEXT,
    "analysisVersion" TEXT NOT NULL DEFAULT 'identity_framing_v1',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'identity_framing_v1',
    "extractor" TEXT NOT NULL DEFAULT 'identity-framing-classifier-v1',
    "modelVersion" TEXT NOT NULL DEFAULT 'lexicon-v1',
    "promptVersion" TEXT NOT NULL DEFAULT 'none',
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceSnapshot" TEXT,
    "reviewStatus" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaIdentityMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityFramingAnalysis" (
    "id" UUID NOT NULL,
    "scope" "AnalysisScope" NOT NULL,
    "scopeEntityId" UUID,
    "scopeHash" TEXT NOT NULL,
    "filters" JSONB,
    "periodStart" DATE,
    "periodEnd" DATE,
    "algorithm" TEXT NOT NULL DEFAULT 'identity_framing_v1',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'identity_framing_v1',
    "modelVersion" TEXT NOT NULL DEFAULT 'lexicon-v1',
    "promptVersion" TEXT NOT NULL DEFAULT 'none',
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSnapshot" TEXT,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedFromUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityFramingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityFramingAggregate" (
    "id" UUID NOT NULL,
    "scope" "IdentityAggregateScope" NOT NULL,
    "scopeEntityId" UUID,
    "scopeHash" TEXT NOT NULL,
    "filters" JSONB,
    "periodStart" DATE,
    "periodEnd" DATE,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'identity_framing_v1',
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedFromUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityFramingAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityComparison" (
    "id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "specHash" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'reverse_case_v1',
    "sampleSizeA" INTEGER NOT NULL DEFAULT 0,
    "sampleSizeB" INTEGER NOT NULL DEFAULT 0,
    "matchedPairs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "effectSize" DOUBLE PRECISION,
    "effectSizeType" TEXT,
    "confidenceInterval" JSONB,
    "missingDataRate" DOUBLE PRECISION,
    "matchingQuality" DOUBLE PRECISION,
    "confounders" JSONB,
    "result" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BirthOriginFact_personEntityId_idx" ON "BirthOriginFact"("personEntityId");

-- CreateIndex
CREATE INDEX "BirthOriginFact_factKind_idx" ON "BirthOriginFact"("factKind");

-- CreateIndex
CREATE INDEX "BirthOriginFact_reviewStatus_idx" ON "BirthOriginFact"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BirthOriginFact_personEntityId_factKind_value_sourceUrl_key" ON "BirthOriginFact"("personEntityId", "factKind", "value", "sourceUrl");

-- CreateIndex
CREATE INDEX "CitizenshipFact_personEntityId_idx" ON "CitizenshipFact"("personEntityId");

-- CreateIndex
CREATE INDEX "CitizenshipFact_countryCode_idx" ON "CitizenshipFact"("countryCode");

-- CreateIndex
CREATE INDEX "CitizenshipFact_reviewStatus_idx" ON "CitizenshipFact"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenshipFact_personEntityId_countryCode_status_sourceUrl_key" ON "CitizenshipFact"("personEntityId", "countryCode", "status", "sourceUrl");

-- CreateIndex
CREATE INDEX "ResidenceFact_personEntityId_idx" ON "ResidenceFact"("personEntityId");

-- CreateIndex
CREATE INDEX "ResidenceFact_countryCode_idx" ON "ResidenceFact"("countryCode");

-- CreateIndex
CREATE INDEX "ResidenceFact_reviewStatus_idx" ON "ResidenceFact"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ResidenceFact_personEntityId_countryCode_municipality_start_key" ON "ResidenceFact"("personEntityId", "countryCode", "municipality", "startDate", "endDate", "sourceUrl");

-- CreateIndex
CREATE INDEX "SelfIdentificationFact_personEntityId_idx" ON "SelfIdentificationFact"("personEntityId");

-- CreateIndex
CREATE INDEX "SelfIdentificationFact_reviewStatus_idx" ON "SelfIdentificationFact"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SelfIdentificationFact_personEntityId_identityLabel_sourceU_key" ON "SelfIdentificationFact"("personEntityId", "identityLabel", "sourceUrl");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_personEntityId_idx" ON "MediaIdentityMention"("personEntityId");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_articleId_idx" ON "MediaIdentityMention"("articleId");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_mediaOutletEntityId_idx" ON "MediaIdentityMention"("mediaOutletEntityId");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_journalistEntityId_idx" ON "MediaIdentityMention"("journalistEntityId");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_expressionNormalized_idx" ON "MediaIdentityMention"("expressionNormalized");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_termCategory_idx" ON "MediaIdentityMention"("termCategory");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_reviewStatus_idx" ON "MediaIdentityMention"("reviewStatus");

-- CreateIndex
CREATE INDEX "MediaIdentityMention_publishedAt_idx" ON "MediaIdentityMention"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaIdentityMention_personEntityId_articleId_expressionNor_key" ON "MediaIdentityMention"("personEntityId", "articleId", "expressionNormalized", "termCategory");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityFramingAnalysis_scopeHash_key" ON "IdentityFramingAnalysis"("scopeHash");

-- CreateIndex
CREATE INDEX "IdentityFramingAnalysis_scopeEntityId_idx" ON "IdentityFramingAnalysis"("scopeEntityId");

-- CreateIndex
CREATE INDEX "IdentityFramingAnalysis_scope_algorithm_idx" ON "IdentityFramingAnalysis"("scope", "algorithm");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityFramingAggregate_scopeHash_key" ON "IdentityFramingAggregate"("scopeHash");

-- CreateIndex
CREATE INDEX "IdentityFramingAggregate_scopeEntityId_idx" ON "IdentityFramingAggregate"("scopeEntityId");

-- CreateIndex
CREATE INDEX "IdentityFramingAggregate_scope_algorithmVersion_idx" ON "IdentityFramingAggregate"("scope", "algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityComparison_specHash_key" ON "IdentityComparison"("specHash");

-- CreateIndex
CREATE INDEX "IdentityComparison_direction_idx" ON "IdentityComparison"("direction");

-- CreateIndex
CREATE INDEX "IdentityComparison_status_idx" ON "IdentityComparison"("status");

-- AddForeignKey
ALTER TABLE "BirthOriginFact" ADD CONSTRAINT "BirthOriginFact_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenshipFact" ADD CONSTRAINT "CitizenshipFact_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceFact" ADD CONSTRAINT "ResidenceFact_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfIdentificationFact" ADD CONSTRAINT "SelfIdentificationFact_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaIdentityMention" ADD CONSTRAINT "MediaIdentityMention_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaIdentityMention" ADD CONSTRAINT "MediaIdentityMention_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaIdentityMention" ADD CONSTRAINT "MediaIdentityMention_mediaOutletEntityId_fkey" FOREIGN KEY ("mediaOutletEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaIdentityMention" ADD CONSTRAINT "MediaIdentityMention_journalistEntityId_fkey" FOREIGN KEY ("journalistEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
