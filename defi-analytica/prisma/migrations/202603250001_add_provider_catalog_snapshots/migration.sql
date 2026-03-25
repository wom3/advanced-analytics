CREATE TABLE "provider_catalog_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "provider_catalog_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_catalog_snapshots_provider_resource_scope_fetchedAt_idx"
ON "provider_catalog_snapshots"("provider", "resource", "scope", "fetchedAt");