-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('AUTO_DETECTED', 'SOURCE_CONFIRMED', 'HUMAN_VERIFIED', 'DISPUTED', 'REJECTED', 'STALE');

-- AlterTable
ALTER TABLE "FinancialFlow" ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED';

-- AlterTable
ALTER TABLE "Relationship" ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED';

-- CreateIndex
CREATE INDEX "FinancialFlow_verificationStatus_idx" ON "FinancialFlow"("verificationStatus");

-- CreateIndex
CREATE INDEX "Relationship_verificationStatus_idx" ON "Relationship"("verificationStatus");

-- confidence_score range constraint (A7): NULL or within [0, 1].
ALTER TABLE "Relationship"
  ADD CONSTRAINT "Relationship_confidenceScore_range"
  CHECK ("confidenceScore" IS NULL OR ("confidenceScore" >= 0 AND "confidenceScore" <= 1));

ALTER TABLE "FinancialFlow"
  ADD CONSTRAINT "FinancialFlow_confidenceScore_range"
  CHECK ("confidenceScore" IS NULL OR ("confidenceScore" >= 0 AND "confidenceScore" <= 1));
