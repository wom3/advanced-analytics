import { z } from "zod";

import {
  getLlamaDexFilterCatalog,
  type LlamaDexFilterCatalog,
} from "@/src/server/adapters/defillama/client";
import { env } from "@/src/env";
import { CACHE_TTL_SECONDS, CATALOG_CACHE_KEY_PREFIX } from "@/src/server/cache/policy";
import { cacheGet, cacheSet } from "@/src/server/cache/redis";
import { prisma } from "@/src/server/db/prisma";
import { logApiWarn } from "@/src/server/observability/logger";

const LLAMA_CATALOG_PROVIDER = "defillama";
const LLAMA_CATALOG_RESOURCE = "dex-filter-catalog";
const DEFAULT_CHAIN = "Ethereum";
const CATALOG_SOFT_STALE_SEC = 3_600;
const CATALOG_HARD_STALE_SEC = 21_600;
const CATALOG_RETENTION_DAYS = 30;

const catalogSchema = z.object({
  activeChain: z.string().trim().min(1),
  chains: z.array(z.string().trim().min(1)),
  protocols: z.array(
    z.object({
      name: z.string().trim().min(1),
      slug: z.string().trim().min(1),
      category: z.string().trim().min(1).nullable(),
      chains: z.array(z.string().trim().min(1)).min(1),
    })
  ),
});

const cachedCatalogSchema = z.object({
  asOf: z.string().datetime(),
  catalog: catalogSchema,
});

export type DefiLlamaCatalogResolution = {
  source: "cache" | "database" | "upstream";
  asOf: string;
  catalog: LlamaDexFilterCatalog;
};

function normalizeChain(chain: string | undefined): string {
  const normalized = chain?.trim();
  return normalized || DEFAULT_CHAIN;
}

function catalogCacheKey(chain: string): string {
  const normalized = chain.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${CATALOG_CACHE_KEY_PREFIX}:defillama:dex-filters:${normalized}`;
}

function ageSec(asOf: string): number {
  return Math.max(Math.floor((Date.now() - Date.parse(asOf)) / 1_000), 0);
}

function isStale(asOf: string, maxAgeSec: number): boolean {
  return ageSec(asOf) > maxAgeSec;
}

async function loadCachedCatalog(chain: string): Promise<DefiLlamaCatalogResolution | null> {
  const cached = await cacheGet<unknown>(catalogCacheKey(chain));
  const parsed = cachedCatalogSchema.safeParse(cached);
  if (!parsed.success) {
    return null;
  }

  return {
    source: "cache",
    asOf: parsed.data.asOf,
    catalog: parsed.data.catalog,
  };
}

async function persistCatalogSnapshot(
  chain: string,
  catalog: LlamaDexFilterCatalog,
  asOf: string,
  requestId: string
): Promise<void> {
  if (!env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.providerCatalogSnapshot.create({
      data: {
        provider: LLAMA_CATALOG_PROVIDER,
        resource: LLAMA_CATALOG_RESOURCE,
        scope: chain,
        payloadJson: catalog,
        fetchedAt: new Date(asOf),
        requestId,
        sourceUrl: `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}`,
      },
    });
  } catch (error) {
    logApiWarn({
      event: "catalog.defillama.persist_failed",
      requestId,
      message: error instanceof Error ? error.message : "Unknown Prisma persistence error",
      meta: { chain },
    });
  }
}

async function pruneCatalogSnapshots(chain: string, requestId: string): Promise<void> {
  if (!env.DATABASE_URL) {
    return;
  }

  try {
    const cutoff = new Date(Date.now() - CATALOG_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
    await prisma.providerCatalogSnapshot.deleteMany({
      where: {
        provider: LLAMA_CATALOG_PROVIDER,
        resource: LLAMA_CATALOG_RESOURCE,
        scope: chain,
        fetchedAt: {
          lt: cutoff,
        },
      },
    });
  } catch (error) {
    logApiWarn({
      event: "catalog.defillama.prune_failed",
      requestId,
      message: error instanceof Error ? error.message : "Unknown Prisma prune error",
      meta: { chain, retentionDays: CATALOG_RETENTION_DAYS },
    });
  }
}

async function loadCatalogSnapshotFromDatabase(
  chain: string,
  requestId: string
): Promise<DefiLlamaCatalogResolution | null> {
  if (!env.DATABASE_URL) {
    return null;
  }

  try {
    const snapshot = await prisma.providerCatalogSnapshot.findFirst({
      where: {
        provider: LLAMA_CATALOG_PROVIDER,
        resource: LLAMA_CATALOG_RESOURCE,
        scope: chain,
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!snapshot) {
      return null;
    }

    const parsed = catalogSchema.safeParse(snapshot.payloadJson);
    if (!parsed.success) {
      return null;
    }

    return {
      source: "database",
      asOf: snapshot.fetchedAt.toISOString(),
      catalog: parsed.data,
    };
  } catch (error) {
    logApiWarn({
      event: "catalog.defillama.db_load_failed",
      requestId,
      message: error instanceof Error ? error.message : "Unknown Prisma read error",
      meta: { chain },
    });
    return null;
  }
}

async function writeCatalogCache(record: { chain: string; asOf: string; catalog: LlamaDexFilterCatalog }) {
  await cacheSet(
    catalogCacheKey(record.chain),
    {
      asOf: record.asOf,
      catalog: record.catalog,
    },
    CACHE_TTL_SECONDS["llama.catalog"]
  );
}

function scheduleCatalogRefresh(chain: string, requestId: string): void {
  void refreshDefiLlamaDexCatalog(chain, requestId).catch((error) => {
    logApiWarn({
      event: "catalog.defillama.background_refresh_failed",
      requestId,
      message: error instanceof Error ? error.message : "Unknown background refresh error",
      meta: { chain },
    });
  });
}

export async function refreshDefiLlamaDexCatalog(
  chain: string | undefined,
  requestId = "system"
): Promise<DefiLlamaCatalogResolution> {
  const normalizedChain = normalizeChain(chain);
  const catalog = await getLlamaDexFilterCatalog(normalizedChain);
  const asOf = new Date().toISOString();

  await Promise.all([
    writeCatalogCache({ chain: normalizedChain, asOf, catalog }),
    persistCatalogSnapshot(normalizedChain, catalog, asOf, requestId),
    pruneCatalogSnapshots(normalizedChain, requestId),
  ]);

  return {
    source: "upstream",
    asOf,
    catalog,
  };
}

export async function getDefiLlamaDexCatalog(
  chain: string | undefined,
  requestId = "system"
): Promise<DefiLlamaCatalogResolution> {
  const normalizedChain = normalizeChain(chain);

  const cached = await loadCachedCatalog(normalizedChain);
  if (cached) {
    if (isStale(cached.asOf, CATALOG_SOFT_STALE_SEC)) {
      scheduleCatalogRefresh(normalizedChain, requestId);
    }

    if (isStale(cached.asOf, CATALOG_HARD_STALE_SEC)) {
      try {
        return await refreshDefiLlamaDexCatalog(normalizedChain, requestId);
      } catch {
        return cached;
      }
    }

    return cached;
  }

  const fromDatabase = await loadCatalogSnapshotFromDatabase(normalizedChain, requestId);
  if (fromDatabase) {
    await writeCatalogCache({
      chain: normalizedChain,
      asOf: fromDatabase.asOf,
      catalog: fromDatabase.catalog,
    });

    if (isStale(fromDatabase.asOf, CATALOG_SOFT_STALE_SEC)) {
      scheduleCatalogRefresh(normalizedChain, requestId);
    }

    if (isStale(fromDatabase.asOf, CATALOG_HARD_STALE_SEC)) {
      try {
        return await refreshDefiLlamaDexCatalog(normalizedChain, requestId);
      } catch {
        return fromDatabase;
      }
    }

    return fromDatabase;
  }

  return refreshDefiLlamaDexCatalog(normalizedChain, requestId);
}