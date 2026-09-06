-- CreateTable
CREATE TABLE "NetworkAnalytics" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "temporal" TEXT NOT NULL DEFAULT 'current',
    "algorithm" TEXT NOT NULL DEFAULT 'degree+brandes-betweenness',
    "algorithmVersion" TEXT NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "edgeCount" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "graphMaxUpdatedAt" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkAnalytics_scopeHash_key" ON "NetworkAnalytics"("scopeHash");

-- CreateIndex
CREATE INDEX "NetworkAnalytics_scope_idx" ON "NetworkAnalytics"("scope");

