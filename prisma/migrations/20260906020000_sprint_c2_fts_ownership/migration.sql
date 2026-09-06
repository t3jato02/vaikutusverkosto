-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RelationshipType" ADD VALUE 'REGISTERED_LOBBY_ORGANIZATION';
ALTER TYPE "RelationshipType" ADD VALUE 'REPRESENTS_INTERESTS_OF';
ALTER TYPE "RelationshipType" ADD VALUE 'CLIENT_OF';
ALTER TYPE "RelationshipType" ADD VALUE 'DECLARED_EU_INTEREST';
ALTER TYPE "RelationshipType" ADD VALUE 'ACCREDITED_REPRESENTATIVE_OF';

-- AlterTable
ALTER TABLE "FinancialFlow" ADD COLUMN     "externalRecordId" TEXT,
ADD COLUMN     "rawFundingType" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "funderEntityId" UUID,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "programme" TEXT,
ADD COLUMN     "sourceIdentifier" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FinancialFlow_externalRecordId_key" ON "FinancialFlow"("externalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_sourceIdentifier_key" ON "Project"("sourceIdentifier");

-- CreateIndex
CREATE INDEX "Project_programme_idx" ON "Project"("programme");

