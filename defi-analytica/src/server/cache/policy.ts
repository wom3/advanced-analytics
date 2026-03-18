export type CacheGroup =
  | "llama.metrics"
  | "coingecko.market"
  | "fng.latest"
  | "fng.history"
  | "sentiment.score"
  | "sentiment.history"
  | "dashboard.overview";

export const CACHE_TTL_SECONDS: Record<CacheGroup, number> = {
  "llama.metrics": 120,
  "coingecko.market": 120,
  "fng.latest": 60,
  "fng.history": 300,
  "sentiment.score": 60,
  "sentiment.history": 180,
  "dashboard.overview": 60,
};

export const HTTP_CACHE_KEY_PREFIX = "aa:v1:http";

export const CACHE_GROUP_PREFIXES: Record<CacheGroup, string[]> = {
  "llama.metrics": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/llama/metrics/`],
  "coingecko.market": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/coingecko/market/`],
  "fng.latest": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/fng/latest`],
  "fng.history": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/fng/history`],
  "sentiment.score": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/sentiment/score`],
  "sentiment.history": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/sentiment/history`],
  "dashboard.overview": [`${HTTP_CACHE_KEY_PREFIX}:/api/v1/dashboard/overview`],
};
