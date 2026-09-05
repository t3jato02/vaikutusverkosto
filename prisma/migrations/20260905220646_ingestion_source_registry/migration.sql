-- CreateEnum
CREATE TYPE "ReliabilityTier" AS ENUM ('OFFICIAL_PRIMARY', 'OFFICIAL_REGISTER', 'PUBLIC_DISCLOSURE', 'ANNUAL_REPORT', 'REPUTABLE_MEDIA', 'OTHER');

-- CreateTable
CREATE TABLE "IngestionSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "adapter" TEXT NOT NULL,
    "reliabilityTier" "ReliabilityTier" NOT NULL DEFAULT 'OFFICIAL_PRIMARY',
    "format" TEXT NOT NULL DEFAULT 'API',
    "updateCadence" TEXT NOT NULL DEFAULT 'daily',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "termsUrl" TEXT,
    "notes" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionSource_enabled_idx" ON "IngestionSource"("enabled");
