import type { NextRequest } from "next/server";

import { env } from "@/src/env";
import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  ExchangeApiError,
  getExchangeMicrostructureSeries,
} from "@/src/server/adapters/exchange/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseSymbol(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(value)) {
    throw new ExchangeApiError(
      "symbol must be 5-20 characters and contain only A-Z and 0-9.",
      400,
      false
    );
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
      throw new ExchangeApiError(
        `${name} must be a non-negative unix timestamp in seconds.`,
        400,
        false
      );
    }
    return numeric;
  }

  const asDate = Date.parse(parsedValue);
  if (!Number.isFinite(asDate)) {
    throw new ExchangeApiError(
      `${name} must be a unix timestamp in seconds or an ISO-8601 datetime.`,
      400,
      false
    );
  }

  const epochSeconds = Math.floor(asDate / 1_000);
  if (epochSeconds < 0) {
    throw new ExchangeApiError(`${name} must be on/after 1970-01-01T00:00:00Z.`, 400, false);
  }
  return epochSeconds;
}

function parseOptionalLimit(value: string | null): number | undefined {
  const parsedValue = parseOptionalString(value);
  if (!parsedValue) {
    return undefined;
  }

  const numeric = Number(parsedValue);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 1000) {
    throw new ExchangeApiError("limit must be an integer between 1 and 1000.", 400, false);
  }
  return numeric;
}

function isAllowedSymbol(symbol: string): boolean {
  return env.EXCHANGE_ALLOWED_SYMBOLS.includes(symbol);
}

export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.market.microstructure.rate_limited",
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

  if (!env.ENABLE_EXCHANGE_SIGNALS) {
    logApiWarn({
      event: "api.market.microstructure.feature_disabled",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 404,
      durationMs: Date.now() - startedAt,
    });

    const response = jsonError({
      code: "EXCHANGE_SIGNALS_DISABLED",
      message: "Exchange microstructure signals are disabled for this deployment.",
      retryable: false,
      provider: "internal",
      status: 404,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }

  try {
    const { symbol: rawSymbol } = await context.params;
    const symbol = parseSymbol(rawSymbol);

    if (!isAllowedSymbol(symbol)) {
      throw new ExchangeApiError(
        `symbol must be one of: ${env.EXCHANGE_ALLOWED_SYMBOLS.join(", ")}.`,
        400,
        false
      );
    }

    const interval = parseOptionalString(request.nextUrl.searchParams.get("interval"));
    const sinceSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("since"), "since");
    const untilSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("until"), "until");
    const limit = parseOptionalLimit(request.nextUrl.searchParams.get("limit"));

    if (sinceSec !== undefined && untilSec !== undefined && sinceSec > untilSec) {
      throw new ExchangeApiError("since must be less than or equal to until.", 400, false);
    }

    const options: Record<string, string | number | undefined> = {};
    if (interval !== undefined) options["interval"] = interval;
    if (sinceSec !== undefined) options["sinceSec"] = sinceSec;
    if (untilSec !== undefined) options["untilSec"] = untilSec;
    if (limit !== undefined) options["limit"] = limit;

    const result = await getExchangeMicrostructureSeries(
      symbol,
      options as Parameters<typeof getExchangeMicrostructureSeries>[1]
    );

    const asOf = result.points.at(-1)?.timestamp ?? new Date().toISOString();

    logApiInfo({
      event: "api.market.microstructure.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        symbol,
        interval: result.interval,
        points: result.points.length,
      },
    });

    const response = jsonSuccess({
      source: "exchange",
      asOf,
      freshnessSec: 0,
      requestId,
      data: result,
      meta: {
        route: "/api/v1/market/microstructure/:symbol",
        symbol,
        interval: result.interval,
        venue: result.venue,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const exchangeError = error as ExchangeApiError;

    logApiError({
      event: "api.market.microstructure.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: exchangeError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: exchangeError.message,
    });

    const response = jsonError({
      code: "MICROSTRUCTURE_FETCH_FAILED",
      message: exchangeError.message || "Failed to fetch exchange microstructure data.",
      retryable: exchangeError.retryable ?? true,
      provider: "exchange",
      status: exchangeError.status ?? 500,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
