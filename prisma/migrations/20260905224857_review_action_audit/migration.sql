-- CreateTable
CREATE TABLE "ReviewAction" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'admin',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewAction_targetType_targetId_idx" ON "ReviewAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ReviewAction_createdAt_idx" ON "ReviewAction"("createdAt");
