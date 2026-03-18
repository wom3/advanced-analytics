-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "provider_raw_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusCode" INTEGER NOT NULL,
    "requestId" TEXT,

    CONSTRAINT "provider_raw_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_points" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "assetOrSymbol" TEXT,
    "interval" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueJson" JSONB,
    "asOf" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "normalized_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_points" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "assetOrSymbol" TEXT,
    "interval" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_scores" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "factorsJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_cache_index" (
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_cache_index_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateIndex
CREATE INDEX "provider_raw_snapshots_provider_resource_fetchedAt_idx" ON "provider_raw_snapshots"("provider", "resource", "fetchedAt");

-- CreateIndex
CREATE INDEX "provider_raw_snapshots_requestHash_idx" ON "provider_raw_snapshots"("requestHash");

-- CreateIndex
CREATE INDEX "normalized_points_provider_metric_timestamp_idx" ON "normalized_points"("provider", "metric", "timestamp");

-- CreateIndex
CREATE INDEX "normalized_points_assetOrSymbol_interval_timestamp_idx" ON "normalized_points"("assetOrSymbol", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "normalized_points_provider_metric_assetOrSymbol_interval_ti_key" ON "normalized_points"("provider", "metric", "assetOrSymbol", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "feature_points_feature_timestamp_idx" ON "feature_points"("feature", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "feature_points_feature_provider_assetOrSymbol_interval_time_key" ON "feature_points"("feature", "provider", "assetOrSymbol", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "sentiment_scores_timestamp_key" ON "sentiment_scores"("timestamp");

-- CreateIndex
CREATE INDEX "sentiment_scores_timestamp_idx" ON "sentiment_scores"("timestamp");

-- CreateIndex
CREATE INDEX "api_cache_index_provider_route_idx" ON "api_cache_index"("provider", "route");

-- CreateIndex
CREATE INDEX "api_cache_index_expiresAt_idx" ON "api_cache_index"("expiresAt");

