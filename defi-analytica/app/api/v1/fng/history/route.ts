import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  ALTERNATIVE_ATTRIBUTION,
  ALTERNATIVE_MAX_LIMIT,
  AlternativeApiError,
  getFearGreedHistory,
} from "@/src/server/adapters/alternative/client";
import {
  buildHttpCacheKey,
  getCachedSuccessEnvelope,
  setCachedSuccessEnvelope,
  type CachedSuccessEnvelope,
} from "@/src/server/cache/http-cache";
import { CACHE_TTL_SECONDS } from "@/src/server/cache/policy";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseOptionalTimestamp(value: string | null, name: string): number | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (!Number.isInteger(numeric) || numeric < 0) {
      throw new AlternativeApiError(
        `${name} must be a non-negative unix timestamp in seconds.`,
        400,
        false
      );
    }
    return numeric;
  }

  const asDate = Date.parse(value);
  if (!Number.isFinite(asDate)) {
    throw new AlternativeApiError(
      `${name} must be a unix timestamp in seconds or an ISO-8601 datetime.`,
      400,
      false
    );
  }

  const epochSeconds = Math.floor(asDate / 1_000);
  if (epochSeconds < 0) {
    throw new AlternativeApiError(`${name} must be on/after 1970-01-01T00:00:00Z.`, 400, false);
  }
  return epochSeconds;
}

function parseOptionalLimit(value: string | null): number | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > ALTERNATIVE_MAX_LIMIT) {
    throw new AlternativeApiError(
      `limit must be an integer between 1 and ${ALTERNATIVE_MAX_LIMIT}.`,
      400,
      false
    );
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
      event: "api.fng.history.rate_limited",
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
    const limit = parseOptionalLimit(request.nextUrl.searchParams.get("limit"));
    const sinceSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("since"), "since");
    const untilSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("until"), "until");

    if (sinceSec !== undefined && untilSec !== undefined && sinceSec > untilSec) {
      throw new AlternativeApiError("since must be less than or equal to until.", 400, false);
    }

    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<
        Awaited<ReturnType<typeof getFearGreedHistory>> extends infer T
          ? { points: T extends unknown[] ? T : never }
          : never
      >(cacheKey);
    if (cached) {
      logApiInfo({
        event: "api.fng.history.cache_hit",
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

    const points = await getFearGreedHistory({
      ...(limit !== undefined ? { limit } : {}),
      ...(sinceSec !== undefined ? { sinceSec } : {}),
      ...(untilSec !== undefined ? { untilSec } : {}),
    });

    const asOf = points.at(-1)?.timestamp ?? new Date().toISOString();

    logApiInfo({
      event: "api.fng.history.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        points: points.length,
        limit: limit ?? 100,
      },
    });

    const successPayload: CachedSuccessEnvelope<{ points: typeof points }> = {
      source: "alternative",
      asOf,
      freshnessSec: 0,
      data: {
        points,
      },
      meta: {
        route: "/api/v1/fng/history",
        attribution: ALTERNATIVE_ATTRIBUTION,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, successPayload, CACHE_TTL_SECONDS["fng.history"]);

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
      event: "api.fng.history.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: altError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: altError.message,
    });
    const response = jsonError({
      code: "FNG_HISTORY_FAILED",
      message: altError.message || "Failed to fetch Fear and Greed history.",
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
