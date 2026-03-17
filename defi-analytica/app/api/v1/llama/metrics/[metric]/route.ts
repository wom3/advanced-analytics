import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  getLlamaMetricSeries,
  LlamaApiError,
  type LlamaMetric,
} from "@/src/server/adapters/defillama/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseMetric(raw: string): LlamaMetric {
  const value = raw.trim().toLowerCase();
  if (value === "tvl" || value === "volume" || value === "fees" || value === "perps") {
    return value;
  }
  throw new LlamaApiError("metric must be one of: tvl, volume, fees, perps.", 400, false);
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
      throw new LlamaApiError(
        `${name} must be a non-negative unix timestamp in seconds.`,
        400,
        false
      );
    }
    return numeric;
  }

  const asDate = Date.parse(parsedValue);
  if (!Number.isFinite(asDate)) {
    throw new LlamaApiError(
      `${name} must be a unix timestamp in seconds or an ISO-8601 datetime.`,
      400,
      false
    );
  }
  return Math.floor(asDate / 1_000);
}

export async function GET(request: NextRequest, context: { params: Promise<{ metric: string }> }) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.llama.metrics.rate_limited",
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
    const { metric: rawMetric } = await context.params;
    const metric = parseMetric(rawMetric);

    const chain = parseOptionalString(request.nextUrl.searchParams.get("chain"));
    const protocol = parseOptionalString(request.nextUrl.searchParams.get("protocol"));
    const interval = parseOptionalString(request.nextUrl.searchParams.get("interval"));
    const sinceSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("since"), "since");
    const untilSec = parseOptionalTimestamp(request.nextUrl.searchParams.get("until"), "until");

    if (sinceSec !== undefined && untilSec !== undefined && sinceSec > untilSec) {
      throw new LlamaApiError("since must be less than or equal to until.", 400, false);
    }

    const options: Record<string, string | number | undefined> = {};
    if (chain !== undefined) options["chain"] = chain;
    if (protocol !== undefined) options["protocol"] = protocol;
    if (interval !== undefined) options["interval"] = interval;
    if (sinceSec !== undefined) options["sinceSec"] = sinceSec;
    if (untilSec !== undefined) options["untilSec"] = untilSec;

    const result = await getLlamaMetricSeries(
      metric,
      options as Parameters<typeof getLlamaMetricSeries>[1]
    );

    const asOf = result.points.at(-1)?.timestamp ?? new Date().toISOString();

    logApiInfo({
      event: "api.llama.metrics.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        metric,
        chain: chain ?? null,
        protocol: protocol ?? null,
        points: result.points.length,
      },
    });

    const response = jsonSuccess({
      source: "defillama",
      asOf,
      freshnessSec: 0,
      requestId,
      data: result,
      meta: {
        route: "/api/v1/llama/metrics/:metric",
        metric,
        chain: chain ?? null,
        protocol: protocol ?? null,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const llamaError = error as LlamaApiError;

    logApiError({
      event: "api.llama.metrics.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: llamaError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: llamaError.message,
    });

    const response = jsonError({
      code: "LLAMA_METRIC_FAILED",
      message: llamaError.message || "Failed to fetch DefiLlama metric data.",
      retryable: llamaError.retryable ?? true,
      provider: "defillama",
      status: llamaError.status ?? 500,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
