-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "cost" DECIMAL(10,4),
ADD COLUMN     "lockToken" UUID,
ADD COLUMN     "lockUntil" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "recordsCreated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recordsUpdated" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "AgentRun_status_startedAt_idx" ON "AgentRun"("status", "startedAt");
