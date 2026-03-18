import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  CoinGeckoApiError,
  getCoinGeckoMarketSeries,
} from "@/src/server/adapters/coingecko/client";
import {
  buildHttpCacheKey,
  getCachedSuccessEnvelope,
  setCachedSuccessEnvelope,
  type CachedSuccessEnvelope,
} from "@/src/server/cache/http-cache";
import { CACHE_TTL_SECONDS } from "@/src/server/cache/policy";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseAsset(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) {
    throw new CoinGeckoApiError("asset is required.", 400, false);
  }
  return value;
}

function parseOptionalString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalTimestamp(value: string | null, name: string): number | undefined {
  const parsedValue = parseOptionalString(value);
  if (!parsedValue) {
    return undefined;
  }

  const numeric = Number(parsedValue);
  if (Number.isFinite(numeric)) {
    if (!Number.isInteger(numeric) || numeric < 0) {
      throw new CoinGeckoApiError(
        `${name} must be a non-negative unix timestamp in seconds.`,
        400,
        false
      );
    }
    return numeric;
  }

  const asDate = Date.parse(parsedValue);
  if (!Number.isFinite(asDate)) {
    throw new CoinGeckoApiError(
      `${name} must be a unix timestamp in seconds or an ISO-8601 datetime.`,
      400,
      false
    );
  }

  const epochSeconds = Math.floor(asDate / 1_000);
  if (epochSeconds < 0) {
    throw new CoinGeckoApiError(
      `${name} must be a non-negative unix timestamp in seconds or an ISO-8601 datetime on/after 1970-01-01T00:00:00Z.`,
      400,
      false
    );
  }
  return epochSeconds;
}

export async function GET(request: NextRequest, context: { params: Promise<{ asset: string }> }) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.coingecko.market.rate_limited",
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
    const { asset: rawAsset } = await context.params;
    const asset = parseAsset(rawAsset);
    const interval = parseOptionalString(request.nextUrl.searchParams.get("interval"));
    const sinceSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("since"), "since");
    const untilSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("until"), "until");

    if (sinceSec !== undefined && untilSec !== undefined && sinceSec > untilSec) {
      throw new CoinGeckoApiError("since must be less than or equal to until.", 400, false);
    }

    const cacheKey = buildHttpCacheKey(request.nextUrl);
    const cached =
      await getCachedSuccessEnvelope<Awaited<ReturnType<typeof getCoinGeckoMarketSeries>>>(
        cacheKey
      );
    if (cached) {
      logApiInfo({
        event: "api.coingecko.market.cache_hit",
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

    const options: Record<string, string | number | undefined> = {};
    if (interval !== undefined) options["interval"] = interval;
    if (sinceSec !== undefined) options["sinceSec"] = sinceSec;
    if (untilSec !== undefined) options["untilSec"] = untilSec;

    const result = await getCoinGeckoMarketSeries(
      asset,
      options as Parameters<typeof getCoinGeckoMarketSeries>[1]
    );

    const asOf = result.points.at(-1)?.timestamp ?? new Date().toISOString();

    logApiInfo({
      event: "api.coingecko.market.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: { asset, points: result.points.length },
    });

    const successPayload: CachedSuccessEnvelope<typeof result> = {
      source: "coingecko",
      asOf,
      freshnessSec: 0,
      data: result,
      meta: {
        route: "/api/v1/coingecko/market/:asset",
        asset,
      },
    };

    await setCachedSuccessEnvelope(cacheKey, successPayload, CACHE_TTL_SECONDS["coingecko.market"]);

    const response = jsonSuccess({
      ...successPayload,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const cgError = error as CoinGeckoApiError;

    logApiError({
      event: "api.coingecko.market.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: cgError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: cgError.message,
    });

    const response = jsonError({
      code: "COINGECKO_MARKET_FAILED",
      message: cgError.message || "Failed to fetch CoinGecko market series.",
      retryable: cgError.retryable ?? true,
      provider: "coingecko",
      status: cgError.status ?? 500,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
