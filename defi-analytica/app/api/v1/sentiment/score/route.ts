import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
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
  type SentimentBuildMode,
} from "@/src/server/services/dashboard/service";

function parseMode(value: string | null): SentimentBuildMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "live") {
    return "live";
  }
  if (normalized === "demo") {
    return "demo";
  }
  throw new Error("mode must be one of: live, demo.");
}

function parseInterval(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "1h";
  if (!/^(\d+)([smhdw])$/.test(normalized)) {
    throw new Error("interval must match pattern like 1h, 6h, 1d, 7d.");
  }
  return normalized;
}

function parsePoints(value: string | null): number {
  if (!value) {
    return 72;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 24 || numeric > 720) {
    throw new Error("points must be an integer between 24 and 720.");
  }
  return numeric;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.sentiment.score.rate_limited",
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
    const mode = parseMode(request.nextUrl.searchParams.get("mode"));
    const interval = parseInterval(request.nextUrl.searchParams.get("interval"));
    const points = parsePoints(request.nextUrl.searchParams.get("points"));
    const asset = request.nextUrl.searchParams.get("asset")?.trim().toLowerCase() || "bitcoin";
    const chain = request.nextUrl.searchParams.get("chain")?.trim() || "Ethereum";

    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<Awaited<ReturnType<typeof buildDashboardOverview>>["score"]>(
        cacheKey
      );

    if (cached) {
      logApiInfo({
        event: "api.sentiment.score.cache_hit",
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

    const overview = await buildDashboardOverview({
      mode,
      interval,
      points,
      asset,
      chain,
    });

    const payload: CachedSuccessEnvelope<typeof overview.score> = {
      source: "blended",
      asOf: overview.asOf,
      freshnessSec: overview.freshnessSec,
      data: overview.score,
      meta: {
        route: "/api/v1/sentiment/score",
        mode,
        points,
        interval,
        asset,
        chain,
        providerStatus: overview.providerStatus,
        featureFactorIds: overview.featureFactorIds,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, payload, CACHE_TTL_SECONDS["sentiment.score"]);

    logApiInfo({
      event: "api.sentiment.score.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        mode,
        label: overview.score.label,
      },
    });

    const response = jsonSuccess({
      ...payload,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute sentiment score.";

    logApiError({
      event: "api.sentiment.score.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 500,
      durationMs: Date.now() - startedAt,
      message,
    });

    const status = /must/.test(message) ? 400 : 500;

    const response = jsonError({
      code: "SENTIMENT_SCORE_FAILED",
      message,
      retryable: status >= 500,
      provider: "internal",
      status,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
