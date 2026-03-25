import type { NextRequest } from "next/server";

import {
  applyRateLimitHeaders,
  getOrCreateRequestId,
  jsonError,
  jsonSuccess,
} from "@/src/server/api/envelope";
import {
  DashboardQueryParseError,
  parseDashboardQuery,
} from "@/src/server/api/dashboard-query";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  buildHttpCacheKey,
  getCachedSuccessEnvelope,
  setCachedSuccessEnvelope,
  type CachedSuccessEnvelope,
} from "@/src/server/cache/http-cache";
import { CACHE_TTL_SECONDS } from "@/src/server/cache/policy";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";
import {
  buildDashboardOverview,
} from "@/src/server/services/dashboard/service";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.sentiment.history.rate_limited",
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
    return applyRateLimitHeaders(response, {
      remaining: 0,
      resetEpochSeconds,
      retryAfterSec: rl.retryAfterSec,
    });
  }

  try {
    const { mode, interval, points, asset, chain } = parseDashboardQuery(
      request.nextUrl.searchParams,
      { defaultPoints: 168 }
    );

    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<Awaited<ReturnType<typeof buildDashboardOverview>>["history"]>(
        cacheKey
      );

    if (cached) {
      logApiInfo({
        event: "api.sentiment.history.cache_hit",
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
      return applyRateLimitHeaders(response, {
        remaining: rl.remaining,
        resetEpochSeconds,
      });
    }

    const overview = await buildDashboardOverview({
      mode,
      interval,
      points,
      asset,
      chain,
    });

    const payload: CachedSuccessEnvelope<typeof overview.history> = {
      source: "blended",
      asOf: overview.asOf,
      freshnessSec: overview.freshnessSec,
      data: overview.history,
      meta: {
        route: "/api/v1/sentiment/history",
        mode,
        points,
        interval,
        asset,
        chain,
        providerStatus: overview.providerStatus,
        featureFactorIds: overview.featureFactorIds,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, payload, CACHE_TTL_SECONDS["sentiment.history"]);

    logApiInfo({
      event: "api.sentiment.history.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        mode,
        points: overview.history.length,
      },
    });

    const response = jsonSuccess({
      ...payload,
      requestId,
    });
    return applyRateLimitHeaders(response, {
      remaining: rl.remaining,
      resetEpochSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute sentiment history.";
    const status = error instanceof DashboardQueryParseError ? error.status : 500;

    logApiError({
      event: "api.sentiment.history.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status,
      durationMs: Date.now() - startedAt,
      message,
    });

    const response = jsonError({
      code: "SENTIMENT_HISTORY_FAILED",
      message,
      retryable: status >= 500,
      provider: "internal",
      status,
      requestId,
    });
    return applyRateLimitHeaders(response, {
      remaining: rl.remaining,
      resetEpochSeconds,
    });
  }
}
