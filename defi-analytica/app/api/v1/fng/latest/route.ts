import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  ALTERNATIVE_ATTRIBUTION,
  AlternativeApiError,
  getFearGreedLatest,
} from "@/src/server/adapters/alternative/client";
import {
  buildHttpCacheKey,
  getCachedSuccessEnvelope,
  setCachedSuccessEnvelope,
  type CachedSuccessEnvelope,
} from "@/src/server/cache/http-cache";
import { CACHE_TTL_SECONDS } from "@/src/server/cache/policy";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.fng.latest.rate_limited",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 429,
      durationMs: Date.now() - startedAt,
    });
    const response = jsonError({
      code: "RATE_LIMITED",
      message: "Too many requests for this endpoint. Please retry later.",
      retryable: true,
      provider: "internal",
      status: 429,
      requestId,
    });
    response.headers.set("retry-after", String(rl.retryAfterSec));
    response.headers.set("x-ratelimit-remaining", "0");
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }

  try {
    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<Awaited<ReturnType<typeof getFearGreedLatest>>>(cacheKey);
    if (cached) {
      logApiInfo({
        event: "api.fng.latest.cache_hit",
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        status: 200,
        durationMs: Date.now() - startedAt,
      });

      const response = jsonSuccess({
        ...cached,
        requestId,
      });
      response.headers.set("x-ratelimit-remaining", String(rl.remaining));
      response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
      return response;
    }

    const latest = await getFearGreedLatest();

    logApiInfo({
      event: "api.fng.latest.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        value: latest.value,
        classification: latest.classification,
      },
    });

    const successPayload: CachedSuccessEnvelope<typeof latest> = {
      source: "alternative",
      asOf: latest.timestamp,
      freshnessSec: latest.timeUntilUpdateSec ?? 0,
      data: latest,
      meta: {
        route: "/api/v1/fng/latest",
        attribution: ALTERNATIVE_ATTRIBUTION,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, successPayload, CACHE_TTL_SECONDS["fng.latest"]);

    const response = jsonSuccess({
      ...successPayload,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const altError = error as AlternativeApiError;
    logApiError({
      event: "api.fng.latest.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: altError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: altError.message,
    });
    const response = jsonError({
      code: "FNG_LATEST_FAILED",
      message: altError.message || "Failed to fetch Fear and Greed latest reading.",
      retryable: altError.retryable ?? true,
      provider: "alternative",
      status: altError.status ?? 500,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
