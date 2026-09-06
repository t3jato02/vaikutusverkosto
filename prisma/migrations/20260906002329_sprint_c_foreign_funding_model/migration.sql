-- CreateEnum
CREATE TYPE "EntityCategory" AS ENUM ('GOVERNMENT', 'GOVERNMENT_AGENCY', 'STATE_OWNED_COMPANY', 'COMPANY', 'FOUNDATION', 'NGO', 'RELIGIOUS_ORGANIZATION', 'THINK_TANK', 'UNIVERSITY', 'INTERNATIONAL_ORGANIZATION', 'POLITICAL_PARTY', 'MEDIA_ORGANIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('GRANT', 'DONATION', 'INVESTMENT', 'PROCUREMENT', 'LOAN', 'SPONSORSHIP', 'MEMBERSHIP_FEE', 'OTHER');

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "entityCategory" "EntityCategory";

-- AlterTable
ALTER TABLE "FinancialFlow" ADD COLUMN     "funderCountryCode" TEXT,
ADD COLUMN     "fundingType" "FundingType",
ADD COLUMN     "isForeign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalAmount" DECIMAL(18,2),
ADD COLUMN     "originalCurrency" TEXT,
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "recipientCountryCode" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "iso2" TEXT NOT NULL,
    "iso3" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("iso2")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locationCountry" TEXT,
    "locationRegion" TEXT,
    "municipality" TEXT,
    "locationPrecision" TEXT NOT NULL DEFAULT 'COUNTRY',
    "startDate" DATE,
    "endDate" DATE,
    "organizerEntityId" UUID,
    "totalFundingEur" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "Project_locationCountry_idx" ON "Project"("locationCountry");

-- CreateIndex
CREATE INDEX "Project_municipality_idx" ON "Project"("municipality");

-- CreateIndex
CREATE INDEX "Entity_countryCode_idx" ON "Entity"("countryCode");

-- CreateIndex
CREATE INDEX "Entity_entityCategory_idx" ON "Entity"("entityCategory");

-- CreateIndex
CREATE INDEX "FinancialFlow_isForeign_idx" ON "FinancialFlow"("isForeign");

-- CreateIndex
CREATE INDEX "FinancialFlow_funderCountryCode_idx" ON "FinancialFlow"("funderCountryCode");

-- CreateIndex
CREATE INDEX "FinancialFlow_projectId_idx" ON "FinancialFlow"("projectId");

-- AddForeignKey
ALTER TABLE "FinancialFlow" ADD CONSTRAINT "FinancialFlow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
