-- AlterTable
ALTER TABLE "Relationship" ADD COLUMN     "supportingSourceCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SourceConflict" (
    "id" UUID NOT NULL,
    "relationshipId" UUID,
    "entityId" UUID,
    "kind" TEXT NOT NULL,
    "claimA" JSONB NOT NULL,
    "claimB" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SourceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceConflict_status_idx" ON "SourceConflict"("status");

-- CreateIndex
CREATE INDEX "SourceConflict_relationshipId_idx" ON "SourceConflict"("relationshipId");

-- Seed supportingSourceCount from existing distinct evidence sources per relationship.
UPDATE "Relationship" r SET "supportingSourceCount" = GREATEST(1, sub.c)
FROM (
  SELECT e."relationshipId" AS rid, count(DISTINCT e."sourceId") AS c
  FROM "Evidence" e WHERE e."relationshipId" IS NOT NULL
  GROUP BY e."relationshipId"
) sub
WHERE r.id = sub.rid;
