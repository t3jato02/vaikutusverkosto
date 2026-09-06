-- CreateEnum
CREATE TYPE "TemporalState" AS ENUM ('CURRENT', 'HISTORICAL', 'UNKNOWN_PERIOD');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'AUTO_ACCEPTABLE', 'NEEDS_REVIEW', 'ACCEPTED', 'REJECTED', 'DUPLICATE', 'CONFLICT');

-- AlterTable
ALTER TABLE "Relationship" ADD COLUMN     "endedReason" TEXT,
ADD COLUMN     "lastConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "observedAt" TIMESTAMP(3),
ADD COLUMN     "temporalState" "TemporalState" NOT NULL DEFAULT 'UNKNOWN_PERIOD';

-- CreateTable
CREATE TABLE "RelationshipCandidate" (
    "id" UUID NOT NULL,
    "sourceEntityRef" JSONB NOT NULL,
    "targetEntityRef" JSONB NOT NULL,
    "resolvedSourceEntityId" UUID,
    "resolvedTargetEntityId" UUID,
    "relationshipType" "RelationshipType" NOT NULL,
    "role" TEXT,
    "amount" DECIMAL(18,2),
    "currency" TEXT,
    "proposedValidFrom" DATE,
    "proposedValidTo" DATE,
    "confidenceScore" DOUBLE PRECISION,
    "extractionMethod" TEXT NOT NULL DEFAULT 'deterministic-parser',
    "extractorVersion" TEXT,
    "sourceDocumentId" UUID,
    "evidenceUrl" TEXT NOT NULL,
    "evidenceTitle" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "agentRunId" UUID,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "publishedRelationshipId" UUID,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelationshipCandidate_status_idx" ON "RelationshipCandidate"("status");

-- CreateIndex
CREATE INDEX "RelationshipCandidate_relationshipType_idx" ON "RelationshipCandidate"("relationshipType");

-- CreateIndex
CREATE INDEX "RelationshipCandidate_sourceDocumentId_idx" ON "RelationshipCandidate"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "Relationship_temporalState_idx" ON "Relationship"("temporalState");

-- Backfill temporalState deterministically (B.5 Phase 4):
--   endDate in the past OR status FORMER/INACTIVE -> HISTORICAL
--   endDate in the future/absent + status ACTIVE  -> CURRENT
--   otherwise (no endDate, not clearly active)     -> UNKNOWN_PERIOD
UPDATE "Relationship" SET "temporalState" = 'HISTORICAL'
  WHERE ("endDate" IS NOT NULL AND "endDate" < CURRENT_DATE)
     OR "status" IN ('FORMER', 'INACTIVE');

UPDATE "Relationship" SET "temporalState" = 'CURRENT'
  WHERE "temporalState" <> 'HISTORICAL'
    AND (
      ("endDate" IS NOT NULL AND "endDate" >= CURRENT_DATE)
      OR ("endDate" IS NULL AND "status" = 'ACTIVE')
    );

UPDATE "Relationship" SET "temporalState" = 'UNKNOWN_PERIOD'
  WHERE "temporalState" NOT IN ('HISTORICAL', 'CURRENT');

-- observedAt / lastConfirmedAt seed from existing verification timestamps.
UPDATE "Relationship"
  SET "observedAt" = COALESCE("observedAt", "firstSeen", "createdAt"),
      "lastConfirmedAt" = COALESCE("lastConfirmedAt", "lastVerifiedAt", "firstSeen", "createdAt");
