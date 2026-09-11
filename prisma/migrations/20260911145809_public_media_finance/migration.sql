-- CreateEnum
CREATE TYPE "BenefitEventType" AS ENUM ('GIFT', 'AWARD', 'HONOUR', 'DECORATION', 'PORTRAIT', 'TRAVEL', 'ACCOMMODATION', 'HOSPITALITY', 'EVENT_TICKET', 'MEAL', 'PRIZE', 'SPONSORED_TRIP', 'COMMISSIONED_WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "ValuePrecision" AS ENUM ('EXACT', 'REPORTED', 'CALCULATED', 'ESTIMATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BenefitReviewStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "StatementKind" AS ENUM ('INCOME', 'EXPENDITURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FlowType" ADD VALUE 'RIGHTS_PAYMENT';
ALTER TYPE "FlowType" ADD VALUE 'CONTENT_PROCUREMENT';

-- CreateTable
CREATE TABLE "BenefitEvent" (
    "id" UUID NOT NULL,
    "eventType" "BenefitEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recipientEntityId" UUID,
    "giverEntityId" UUID,
    "payerEntityId" UUID,
    "beneficiaryEntityId" UUID,
    "subjectEntityId" UUID,
    "artistEntityId" UUID,
    "eventDate" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "monetaryValue" DECIMAL(18,2),
    "currency" TEXT,
    "valueType" "ValuePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "publicFundsUsed" BOOLEAN,
    "country" TEXT,
    "selectionRole" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED',
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "confidenceScore" DOUBLE PRECISION,
    "reviewStatus" "BenefitReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "sourceId" UUID,
    "dedupeKey" TEXT,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStatementItem" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "kind" "StatementKind" NOT NULL,
    "category" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "valueType" "ValuePrecision" NOT NULL DEFAULT 'EXACT',
    "isTotal" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "reportUrl" TEXT NOT NULL,
    "sourceId" UUID,
    "dedupeKey" TEXT,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStatementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BenefitEvent_dedupeKey_key" ON "BenefitEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "BenefitEvent_recipientEntityId_idx" ON "BenefitEvent"("recipientEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_giverEntityId_idx" ON "BenefitEvent"("giverEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_payerEntityId_idx" ON "BenefitEvent"("payerEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_beneficiaryEntityId_idx" ON "BenefitEvent"("beneficiaryEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_subjectEntityId_idx" ON "BenefitEvent"("subjectEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_artistEntityId_idx" ON "BenefitEvent"("artistEntityId");

-- CreateIndex
CREATE INDEX "BenefitEvent_eventType_idx" ON "BenefitEvent"("eventType");

-- CreateIndex
CREATE INDEX "BenefitEvent_reviewStatus_idx" ON "BenefitEvent"("reviewStatus");

-- CreateIndex
CREATE INDEX "BenefitEvent_verificationStatus_idx" ON "BenefitEvent"("verificationStatus");

-- CreateIndex
CREATE INDEX "BenefitEvent_eventDate_idx" ON "BenefitEvent"("eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStatementItem_dedupeKey_key" ON "FinancialStatementItem"("dedupeKey");

-- CreateIndex
CREATE INDEX "FinancialStatementItem_entityId_fiscalYear_idx" ON "FinancialStatementItem"("entityId", "fiscalYear");

-- CreateIndex
CREATE INDEX "FinancialStatementItem_entityId_kind_idx" ON "FinancialStatementItem"("entityId", "kind");

-- CreateIndex
CREATE INDEX "FinancialStatementItem_fiscalYear_idx" ON "FinancialStatementItem"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStatementItem_entityId_fiscalYear_kind_category_re_key" ON "FinancialStatementItem"("entityId", "fiscalYear", "kind", "category", "reportUrl");

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_recipientEntityId_fkey" FOREIGN KEY ("recipientEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_giverEntityId_fkey" FOREIGN KEY ("giverEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_payerEntityId_fkey" FOREIGN KEY ("payerEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_beneficiaryEntityId_fkey" FOREIGN KEY ("beneficiaryEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_artistEntityId_fkey" FOREIGN KEY ("artistEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitEvent" ADD CONSTRAINT "BenefitEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatementItem" ADD CONSTRAINT "FinancialStatementItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatementItem" ADD CONSTRAINT "FinancialStatementItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BenefitEvent confidenceScore must be 0..1 (same rule as Relationship/FinancialFlow).
ALTER TABLE "BenefitEvent"
  ADD CONSTRAINT "BenefitEvent_confidenceScore_range"
  CHECK ("confidenceScore" IS NULL OR ("confidenceScore" >= 0 AND "confidenceScore" <= 1));
