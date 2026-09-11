-- CreateEnum (conditional: the enum may already exist on a drifted dev DB that
-- carries a newer sprint migration; on a clean production baseline it is created
-- here. This is the single migration for the institutional-power foundation.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceGrade') THEN
    CREATE TYPE "EvidenceGrade" AS ENUM ('A', 'B', 'C', 'D', 'E');
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoleType') THEN
    CREATE TYPE "RoleType" AS ENUM ('MP', 'MINISTER', 'MUNICIPAL_POLITICIAN', 'CIVIL_SERVANT', 'CEO', 'DEPUTY_CEO', 'EXECUTIVE', 'BOARD_CHAIR', 'BOARD_VICE_CHAIR', 'BOARD_MEMBER', 'SUPERVISORY_BOARD', 'ADVISORY_BOARD', 'COUNCIL_MEMBER', 'DIRECTOR_GENERAL', 'SECRETARY_GENERAL', 'CHAIR', 'PRESIDENT', 'TRUSTEE', 'REGULATOR', 'POLITICAL_APPOINTEE', 'OWNER_REPRESENTATIVE', 'COMMITTEE_MEMBER', 'SECTOR_COUNCIL', 'ORGANISATION_LEADER', 'UNION_LEADER', 'NGO_LEADER', 'FOUNDATION_EXECUTIVE', 'JOURNALIST', 'MEDIA_EXECUTIVE', 'ACADEMIC_EXECUTIVE', 'PROFESSOR', 'INVESTOR', 'BANKER', 'INVESTMENT_BANKER', 'INSTITUTIONAL_INVESTOR_EXECUTIVE', 'PUBLIC_AGENCY_EXECUTIVE', 'INFRASTRUCTURE_EXECUTIVE', 'DEFENCE_INDUSTRY_EXECUTIVE', 'LOBBYIST', 'OTHER');
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Sector') THEN
    CREATE TYPE "Sector" AS ENUM ('ENERGY', 'ELECTRICITY_TRANSMISSION', 'ELECTRICITY_DISTRIBUTION', 'DISTRICT_HEATING', 'GAS', 'WATER', 'WASTE', 'FOOD', 'AGRICULTURE', 'FOOD_LOGISTICS', 'BANKING', 'INVESTMENT', 'INSURANCE', 'PENSION', 'PAYMENTS', 'TRANSPORT', 'RAIL', 'AVIATION', 'ROAD_TRANSPORT', 'PUBLIC_TRANSIT', 'PORT', 'MARITIME', 'LOGISTICS', 'TELECOM', 'DATA_NETWORK', 'CLOUD', 'CYBERSECURITY', 'TECHNOLOGY', 'PUBLIC_IT', 'HEALTHCARE', 'PHARMA', 'SOCIAL_SECURITY', 'EMERGENCY_SUPPLY', 'AID_ORGANISATION', 'NGO', 'FOUNDATION', 'EMPLOYER_ORGANISATION', 'LABOUR_ORGANISATION', 'MEDIA', 'EDUCATION', 'RESEARCH', 'DEFENCE', 'SECURITY', 'STATE_OWNED', 'MUNICIPAL_OWNED', 'PUBLIC_AGENCY', 'SPECIAL_ASSIGNMENT', 'ALCOHOL_MONOPOLY', 'GAMBLING', 'OTHER');
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CriticalFunction') THEN
    CREATE TYPE "CriticalFunction" AS ENUM ('NATIONAL_GRID', 'LOCAL_GRID', 'GAS_TRANSMISSION', 'TELECOMMUNICATIONS', 'PAYMENT_INFRASTRUCTURE', 'FOOD_DISTRIBUTION', 'RAIL_NETWORK', 'AVIATION', 'PORT_LOGISTICS', 'WATER', 'HEALTHCARE_SUPPLY', 'DEFENCE_SUPPLY', 'GOVERNMENT_IT');
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OwnershipCalculationStatus') THEN
    CREATE TYPE "OwnershipCalculationStatus" AS ENUM ('REPORTED', 'CALCULATED', 'UNKNOWN');
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcurementProcedure') THEN
    CREATE TYPE "ProcurementProcedure" AS ENUM ('OPEN', 'RESTRICTED', 'NEGOTIATED', 'COMPETITIVE_DIALOGUE', 'INNOVATION_PARTNERSHIP', 'DIRECT_AWARD', 'FRAMEWORK_AGREEMENT', 'OTHER');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "appointedByEntityId" UUID,
ADD COLUMN     "appointmentMethod" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "roleType" "RoleType",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_CONFIRMED';

-- AlterTable
ALTER TABLE "Relationship" ADD COLUMN     "externalRecordId" TEXT,
ADD COLUMN     "isIndirect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownershipCalculationStatus" "OwnershipCalculationStatus",
ADD COLUMN     "shareClass" TEXT,
ADD COLUMN     "votingRightsPct" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "OrganizationSector" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "sector" "Sector" NOT NULL,
    "sourceId" UUID,
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "validFrom" DATE,
    "validTo" DATE,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriticalFunctionAssignment" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "function" "CriticalFunction" NOT NULL,
    "classificationSource" TEXT NOT NULL,
    "publicBasis" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "sourceId" UUID,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriticalFunctionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementContract" (
    "id" UUID NOT NULL,
    "contractingAuthorityEntityId" UUID NOT NULL,
    "supplierEntityId" UUID NOT NULL,
    "value" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "cpv" TEXT,
    "procedure" "ProcurementProcedure",
    "publicationUrl" TEXT,
    "awardDate" DATE,
    "noticeId" TEXT,
    "description" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED',
    "sourceId" UUID,
    "dedupeKey" TEXT,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyingEngagement" (
    "id" UUID NOT NULL,
    "organizationEntityId" UUID NOT NULL,
    "targetEntityId" UUID NOT NULL,
    "subject" TEXT,
    "communicationMethod" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,
    "reportedFinancialResources" DECIMAL(18,2),
    "currency" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "evidenceGrade" "EvidenceGrade" NOT NULL DEFAULT 'C',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'AUTO_DETECTED',
    "sourceId" UUID,
    "dedupeKey" TEXT,
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyingEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationSector_sector_idx" ON "OrganizationSector"("sector");

-- CreateIndex
CREATE INDEX "OrganizationSector_entityId_validTo_idx" ON "OrganizationSector"("entityId", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSector_entityId_sector_key" ON "OrganizationSector"("entityId", "sector");

-- CreateIndex
CREATE INDEX "CriticalFunctionAssignment_function_idx" ON "CriticalFunctionAssignment"("function");

-- CreateIndex
CREATE INDEX "CriticalFunctionAssignment_entityId_idx" ON "CriticalFunctionAssignment"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CriticalFunctionAssignment_entityId_function_publicBasis_key" ON "CriticalFunctionAssignment"("entityId", "function", "publicBasis");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementContract_dedupeKey_key" ON "ProcurementContract"("dedupeKey");

-- CreateIndex
CREATE INDEX "ProcurementContract_contractingAuthorityEntityId_idx" ON "ProcurementContract"("contractingAuthorityEntityId");

-- CreateIndex
CREATE INDEX "ProcurementContract_supplierEntityId_idx" ON "ProcurementContract"("supplierEntityId");

-- CreateIndex
CREATE INDEX "ProcurementContract_cpv_idx" ON "ProcurementContract"("cpv");

-- CreateIndex
CREATE INDEX "ProcurementContract_awardDate_idx" ON "ProcurementContract"("awardDate");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyingEngagement_dedupeKey_key" ON "LobbyingEngagement"("dedupeKey");

-- CreateIndex
CREATE INDEX "LobbyingEngagement_organizationEntityId_idx" ON "LobbyingEngagement"("organizationEntityId");

-- CreateIndex
CREATE INDEX "LobbyingEngagement_targetEntityId_idx" ON "LobbyingEngagement"("targetEntityId");

-- CreateIndex
CREATE INDEX "LobbyingEngagement_periodStart_idx" ON "LobbyingEngagement"("periodStart");

-- CreateIndex
CREATE INDEX "Position_roleType_idx" ON "Position"("roleType");

-- CreateIndex
CREATE INDEX "Position_appointedByEntityId_idx" ON "Position"("appointedByEntityId");

-- CreateIndex
CREATE INDEX "Position_isCurrent_roleType_idx" ON "Position"("isCurrent", "roleType");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_externalRecordId_key" ON "Relationship"("externalRecordId");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_appointedByEntityId_fkey" FOREIGN KEY ("appointedByEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSector" ADD CONSTRAINT "OrganizationSector_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSector" ADD CONSTRAINT "OrganizationSector_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticalFunctionAssignment" ADD CONSTRAINT "CriticalFunctionAssignment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticalFunctionAssignment" ADD CONSTRAINT "CriticalFunctionAssignment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementContract" ADD CONSTRAINT "ProcurementContract_contractingAuthorityEntityId_fkey" FOREIGN KEY ("contractingAuthorityEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementContract" ADD CONSTRAINT "ProcurementContract_supplierEntityId_fkey" FOREIGN KEY ("supplierEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementContract" ADD CONSTRAINT "ProcurementContract_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyingEngagement" ADD CONSTRAINT "LobbyingEngagement_organizationEntityId_fkey" FOREIGN KEY ("organizationEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyingEngagement" ADD CONSTRAINT "LobbyingEngagement_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyingEngagement" ADD CONSTRAINT "LobbyingEngagement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;