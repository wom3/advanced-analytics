import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import {
  asOfFromNormalizedResult,
  DuneApiError,
  getExecutionResults,
} from "@/src/server/adapters/dune/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseExecutionId(raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new DuneApiError("executionId is required.", 400, false);
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> }
) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.dune.results.rate_limited",
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
    const { executionId: rawExecutionId } = await context.params;
    const executionId = parseExecutionId(rawExecutionId);
    const limit = parseOptionalInt(request.nextUrl.searchParams.get("limit"), "limit");
    const offset = parseOptionalInt(request.nextUrl.searchParams.get("offset"), "offset");
    const allowPartialResults = request.nextUrl.searchParams.get("allowPartialResults") === "true";

    const result = await getExecutionResults(executionId, {
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
      ...(allowPartialResults ? { allowPartialResults } : {}),
    });

    logApiInfo({
      event: "api.dune.results.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        executionId,
        queryId: result.queryId,
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
        route: "/api/v1/dune/executions/:executionId/results",
        executionId,
        queryId: result.queryId,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const duneError = error as DuneApiError;
    logApiError({
      event: "api.dune.results.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: duneError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: duneError.message,
    });
    const response = jsonError({
      code: "DUNE_RESULTS_FAILED",
      message: duneError.message || "Failed to fetch Dune execution results.",
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
