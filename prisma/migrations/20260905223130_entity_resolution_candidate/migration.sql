-- CreateTable
CREATE TABLE "EntityResolutionCandidate" (
    "id" UUID NOT NULL,
    "ingestionSourceId" TEXT,
    "refName" TEXT NOT NULL,
    "refType" "EntityType" NOT NULL,
    "refJurisdiction" TEXT,
    "refExternalProvider" TEXT,
    "refExternalIdentifier" TEXT,
    "candidateEntityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedEntityId" UUID,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EntityResolutionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityResolutionCandidate_status_idx" ON "EntityResolutionCandidate"("status");

-- CreateIndex
CREATE INDEX "EntityResolutionCandidate_refType_refName_idx" ON "EntityResolutionCandidate"("refType", "refName");
