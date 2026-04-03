import type { NextRequest } from "next/server";

import {
  applyRateLimitHeaders,
  getOrCreateRequestId,
  jsonError,
  jsonSuccess,
} from "@/src/server/api/envelope";
import {
  AnalyticsQueryParseError,
  parseAnalyticsQuery,
} from "@/src/server/api/analytics-query";
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
      event: "api.dashboard.overview.rate_limited",
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
    const { mode, interval, points, asset, chain } = parseAnalyticsQuery(
      request.nextUrl.searchParams
    );

    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<Awaited<ReturnType<typeof buildDashboardOverview>>>(cacheKey);

    if (cached) {
      logApiInfo({
        event: "api.dashboard.overview.cache_hit",
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

    const payload: CachedSuccessEnvelope<typeof overview> = {
      source: "blended",
      asOf: overview.asOf,
      freshnessSec: overview.freshnessSec,
      data: overview,
      meta: {
        route: "/api/v1/dashboard/overview",
        mode,
        points,
        interval,
        asset,
        chain,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, payload, CACHE_TTL_SECONDS["dashboard.overview"]);

    logApiInfo({
      event: "api.dashboard.overview.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        mode,
        label: overview.score.label,
        historyPoints: overview.history.length,
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
    const message = error instanceof Error ? error.message : "Failed to build dashboard overview.";
    const status = error instanceof AnalyticsQueryParseError ? error.status : 500;

    logApiError({
      event: "api.dashboard.overview.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status,
      durationMs: Date.now() - startedAt,
      message,
    });

    const response = jsonError({
      code: "DASHBOARD_OVERVIEW_FAILED",
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
