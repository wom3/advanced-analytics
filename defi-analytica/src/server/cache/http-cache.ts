import { cacheGet, cacheSet } from "@/src/server/cache/redis";
import type { ApiSuccess } from "@/src/server/api/envelope";

import { HTTP_CACHE_KEY_PREFIX } from "./policy";

type CachedSuccessEnvelope<T> = ApiSuccess<T>;

export type { CachedSuccessEnvelope };

export function buildHttpCacheKey(url: URL): string {
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${HTTP_CACHE_KEY_PREFIX}:${url.pathname}${query ? `?${query}` : ""}`;
}

export async function getCachedSuccessEnvelope<T>(
  key: string
): Promise<CachedSuccessEnvelope<T> | null> {
  return cacheGet<CachedSuccessEnvelope<T>>(key);
}

export async function setCachedSuccessEnvelope<T>(
  key: string,
  payload: CachedSuccessEnvelope<T>,
  ttlSec: number
): Promise<void> {
  await cacheSet(key, payload, ttlSec);
}
