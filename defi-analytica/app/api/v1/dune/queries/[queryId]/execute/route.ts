import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import { DuneApiError, executeQueryById } from "@/src/server/adapters/dune/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

type ExecuteBody = {
  performance?: "medium" | "large";
  queryParameters?: Record<string, unknown>;
};

function parseQueryId(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new DuneApiError("queryId must be a positive integer.", 400, false);
  }
  return value;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ queryId: string }> }
) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.dune.execute.rate_limited",
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

    let body: ExecuteBody = {};
    try {
      body = (await request.json()) as ExecuteBody;
    } catch {
      body = {};
    }

    const execution = await executeQueryById(queryId, {
      ...(body.performance ? { performance: body.performance } : {}),
      ...(body.queryParameters ? { queryParameters: body.queryParameters } : {}),
    });

    logApiInfo({
      event: "api.dune.execute.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: { queryId, executionId: execution.executionId },
    });

    const response = jsonSuccess({
      source: "dune",
      asOf: new Date().toISOString(),
      freshnessSec: 0,
      requestId,
      data: {
        queryId,
        executionId: execution.executionId,
        state: execution.state,
      },
      meta: {
        route: "/api/v1/dune/queries/:queryId/execute",
        queryId,
        executionId: execution.executionId,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const duneError = error as DuneApiError;
    logApiError({
      event: "api.dune.execute.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: duneError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: duneError.message,
    });
    const response = jsonError({
      code: "DUNE_EXECUTE_FAILED",
      message: duneError.message || "Failed to execute Dune query.",
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
