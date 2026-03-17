import { createClient } from "redis";

import { env } from "@/src/env";
import { logApiWarn } from "@/src/server/observability/logger";

type AppRedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<AppRedisClient | null> | null = null;

async function connectRedisClient(): Promise<AppRedisClient | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  const client = createClient({
    url: env.REDIS_URL,
  });

  client.on("error", (error) => {
    logApiWarn({
      event: "cache.redis.error",
      requestId: "system",
      message: error.message,
    });
  });

  await client.connect();
  return client;
}

async function getRedisClient(): Promise<AppRedisClient | null> {
  if (!clientPromise) {
    clientPromise = connectRedisClient().catch((error: unknown) => {
      logApiWarn({
        event: "cache.redis.connect_failed",
        requestId: "system",
        message: error instanceof Error ? error.message : "Unknown Redis connection error",
      });
      return null;
    });
  }

  return clientPromise;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    logApiWarn({
      event: "cache.redis.get_failed",
      requestId: "system",
      message: error instanceof Error ? error.message : "Unknown Redis get error",
      meta: { key },
    });
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSec });
  } catch (error) {
    logApiWarn({
      event: "cache.redis.set_failed",
      requestId: "system",
      message: error instanceof Error ? error.message : "Unknown Redis set error",
      meta: { key, ttlSec },
    });
  }
}

export async function cacheUnlinkByPrefix(prefix: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  let removed = 0;

  try {
    for await (const keys of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
      if (!keys.length) {
        continue;
      }

      const result = await client.sendCommand(["UNLINK", ...keys]);
      const numeric = Number(result);
      if (Number.isFinite(numeric)) {
        removed += numeric;
      }
    }
  } catch (error) {
    logApiWarn({
      event: "cache.redis.unlink_failed",
      requestId: "system",
      message: error instanceof Error ? error.message : "Unknown Redis unlink error",
      meta: { prefix },
    });
  }

  return removed;
}
