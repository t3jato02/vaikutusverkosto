-- Institutional-power public-institutions stream (additive migration).
-- Adds a structural, descriptive institutional category for organisations.
-- Guarded enum so the migration is safe on a clean production baseline and on
-- dev databases that may already carry newer sprint migrations.

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstitutionalCategory') THEN
    CREATE TYPE "InstitutionalCategory" AS ENUM (
      'MINISTRY',
      'PRIME_MINISTERS_OFFICE',
      'AGENCY',
      'AUTHORITY',
      'STATE_ENTERPRISE',
      'STATE_OWNED_COMPANY',
      'STATE_SPECIAL_ASSIGNMENT_COMPANY',
      'STATE_INVESTMENT_COMPANY',
      'PUBLIC_FINANCING_INSTITUTION',
      'STATE_FUND',
      'MUNICIPALITY',
      'WELLBEING_SERVICES_COUNTY',
      'MUNICIPAL_OWNED_COMPANY',
      'REGIONAL_COUNCIL',
      'NGO',
      'FOUNDATION',
      'ASSOCIATION',
      'EMPLOYER_ORGANIZATION',
      'TRADE_UNION',
      'PROFESSIONAL_ORGANIZATION',
      'LABOUR_MARKET_CENTRAL_ORGANIZATION',
      'INDUSTRY_ASSOCIATION',
      'CHAMBER_OF_COMMERCE',
      'WORKING_GROUP',
      'ADVISORY_BODY',
      'COMMISSION',
      'COUNCIL',
      'OTHER'
    );
  END IF;
END $$;

-- CreateTable
CREATE TABLE "OrganizationInstitutionalCategory" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "category" "InstitutionalCategory" NOT NULL,
    "sourceId" UUID,
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "validFrom" DATE,
    "validTo" DATE,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInstitutionalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationInstitutionalCategory_category_idx" ON "OrganizationInstitutionalCategory"("category");

-- CreateIndex
CREATE INDEX "OrganizationInstitutionalCategory_entityId_validTo_idx" ON "OrganizationInstitutionalCategory"("entityId", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInstitutionalCategory_entityId_category_key" ON "OrganizationInstitutionalCategory"("entityId", "category");

-- AddForeignKey
ALTER TABLE "OrganizationInstitutionalCategory" ADD CONSTRAINT "OrganizationInstitutionalCategory_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInstitutionalCategory" ADD CONSTRAINT "OrganizationInstitutionalCategory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;