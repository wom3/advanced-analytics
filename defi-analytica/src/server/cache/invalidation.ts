import { cacheUnlinkByPrefix } from "@/src/server/cache/redis";

import { CACHE_GROUP_PREFIXES, type CacheGroup } from "./policy";

export async function invalidateCacheGroups(groups: CacheGroup[]): Promise<number> {
  let removed = 0;

  const uniqueGroups = [...new Set(groups)];
  for (const group of uniqueGroups) {
    for (const prefix of CACHE_GROUP_PREFIXES[group]) {
      removed += await cacheUnlinkByPrefix(prefix);
    }
  }

  return removed;
}

export function getAllCacheGroups(): CacheGroup[] {
  return Object.keys(CACHE_GROUP_PREFIXES) as CacheGroup[];
}
