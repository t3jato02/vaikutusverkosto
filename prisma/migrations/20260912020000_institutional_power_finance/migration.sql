-- Institutional-power finance stream (additive migration).
-- Finance institutions (banks, insurers, pension institutions, investment
-- firms, public financing institutions, payment/stock-exchange infrastructure)
-- and their year-bound, source-bound institutional scale figures.
-- Guarded enums so the migration is safe on a clean production baseline and on
-- dev databases that may already carry newer sprint migrations.

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceInstitutionType') THEN
    CREATE TYPE "FinanceInstitutionType" AS ENUM (
      'BANK',
      'CREDIT_INSTITUTION',
      'SAVINGS_BANK',
      'COOPERATIVE_BANK',
      'INVESTMENT_FIRM',
      'INVESTMENT_BANK',
      'ASSET_MANAGER',
      'FUND_MANAGER',
      'LIFE_INSURANCE_COMPANY',
      'NON_LIFE_INSURANCE_COMPANY',
      'PENSION_INSURER',
      'PUBLIC_PENSION_INSTITUTION',
      'PAYMENT_INSTITUTION',
      'E_MONEY_INSTITUTION',
      'CENTRAL_SECURITIES_DEPOSITORY',
      'STOCK_EXCHANGE',
      'CENTRAL_COUNTERPARTY',
      'CENTRAL_BANK',
      'FINANCIAL_SUPERVISORY_AUTHORITY',
      'INSTITUTIONAL_INVESTOR',
      'SOVEREIGN_INVESTMENT_INSTITUTION',
      'PUBLIC_FINANCING_INSTITUTION',
      'DEVELOPMENT_FINANCE_INSTITUTION',
      'EXPORT_CREDIT_AGENCY',
      'STATE_INVESTMENT_COMPANY',
      'FINANCIAL_GROUP',
      'OTHER'
    );
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScaleMetricType') THEN
    CREATE TYPE "ScaleMetricType" AS ENUM (
      'ASSETS_UNDER_MANAGEMENT',
      'BALANCE_SHEET_TOTAL',
      'INVESTMENT_ASSETS',
      'EQUITY_CAPITAL',
      'REVENUE',
      'PREMIUM_INCOME',
      'PENSION_ASSETS',
      'OTHER'
    );
  END IF;
END $$;

-- CreateTable
CREATE TABLE "FinanceInstitutionProfile" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "institutionType" "FinanceInstitutionType" NOT NULL,
    "finFsaRegistrationId" TEXT,
    "lei" TEXT,
    "bic" TEXT,
    "officialUrl" TEXT,
    "sourceId" UUID,
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "validFrom" DATE,
    "validTo" DATE,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInstitutionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionScaleStatement" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "metricType" "ScaleMetricType" NOT NULL,
    "value" DECIMAL(18, 2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "year" INTEGER NOT NULL,
    "sourceId" UUID,
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED',
    "dedupeKey" TEXT,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionScaleStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInstitutionProfile_entityId_institutionType_key" ON "FinanceInstitutionProfile"("entityId", "institutionType");

-- CreateIndex
CREATE INDEX "FinanceInstitutionProfile_institutionType_idx" ON "FinanceInstitutionProfile"("institutionType");

-- CreateIndex
CREATE INDEX "FinanceInstitutionProfile_finFsaRegistrationId_idx" ON "FinanceInstitutionProfile"("finFsaRegistrationId");

-- CreateIndex
CREATE INDEX "FinanceInstitutionProfile_lei_idx" ON "FinanceInstitutionProfile"("lei");

-- CreateIndex
CREATE INDEX "FinanceInstitutionProfile_bic_idx" ON "FinanceInstitutionProfile"("bic");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionScaleStatement_entityId_metricType_year_key" ON "InstitutionScaleStatement"("entityId", "metricType", "year");

-- CreateIndex
CREATE INDEX "InstitutionScaleStatement_metricType_year_idx" ON "InstitutionScaleStatement"("metricType", "year");

-- CreateIndex
CREATE INDEX "InstitutionScaleStatement_entityId_metricType_idx" ON "InstitutionScaleStatement"("entityId", "metricType");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionScaleStatement_dedupeKey_key" ON "InstitutionScaleStatement"("dedupeKey");

-- AddForeignKey
ALTER TABLE "FinanceInstitutionProfile" ADD CONSTRAINT "FinanceInstitutionProfile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstitutionProfile" ADD CONSTRAINT "FinanceInstitutionProfile_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionScaleStatement" ADD CONSTRAINT "InstitutionScaleStatement_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionScaleStatement" ADD CONSTRAINT "InstitutionScaleStatement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;