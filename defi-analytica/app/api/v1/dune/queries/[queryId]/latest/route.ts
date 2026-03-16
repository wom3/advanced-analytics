import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  asOfFromNormalizedResult,
  DuneApiError,
  getLatestQueryResult,
} from "@/src/server/adapters/dune/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseQueryId(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new DuneApiError("queryId must be a positive integer.", 400, false);
  }
  return value;
}

function parseOptionalInt(value: string | null, name: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new DuneApiError(`${name} must be a non-negative integer.`, 400, false);
  }
  return parsed;
}

export async function GET(request: NextRequest, context: { params: Promise<{ queryId: string }> }) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.dune.latest.rate_limited",
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
    const { queryId: rawQueryId } = await context.params;
    const queryId = parseQueryId(rawQueryId);
    const limit = parseOptionalInt(request.nextUrl.searchParams.get("limit"), "limit");
    const offset = parseOptionalInt(request.nextUrl.searchParams.get("offset"), "offset");
    const allowPartialResults = request.nextUrl.searchParams.get("allowPartialResults") === "true";

    const result = await getLatestQueryResult(queryId, {
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
      ...(allowPartialResults ? { allowPartialResults } : {}),
    });

    logApiInfo({
      event: "api.dune.latest.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        queryId,
        executionId: result.executionId,
        rowCount: result.rowCount,
      },
    });

    const response = jsonSuccess({
      source: "dune",
      asOf: asOfFromNormalizedResult(result),
      freshnessSec: 0,
      requestId,
      data: result,
      meta: {
        route: "/api/v1/dune/queries/:queryId/latest",
        queryId,
        executionId: result.executionId,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const duneError = error as DuneApiError;
    logApiError({
      event: "api.dune.latest.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: duneError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: duneError.message,
    });
    const response = jsonError({
      code: "DUNE_LATEST_FAILED",
      message: duneError.message || "Failed to fetch latest Dune query result.",
      retryable: duneError.retryable ?? true,
      provider: "dune",
      status: duneError.status ?? 500,
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  }
}
