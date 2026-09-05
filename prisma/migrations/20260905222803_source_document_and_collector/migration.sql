-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED_UNCHANGED');

-- AlterTable
ALTER TABLE "IngestionSource" ADD COLUMN     "lastRunDocsChanged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRunDocsChecked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRunDurationMs" INTEGER;

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" UUID NOT NULL,
    "ingestionSourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'json',
    "title" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "mimeType" TEXT,
    "rawJson" JSONB,
    "rawText" TEXT,
    "storageRef" TEXT,
    "parserVersion" TEXT,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceDocument_ingestionSourceId_processingStatus_idx" ON "SourceDocument"("ingestionSourceId", "processingStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_contentHash_idx" ON "SourceDocument"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_ingestionSourceId_externalId_key" ON "SourceDocument"("ingestionSourceId", "externalId");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_ingestionSourceId_fkey" FOREIGN KEY ("ingestionSourceId") REFERENCES "IngestionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
