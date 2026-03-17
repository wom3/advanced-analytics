import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import { DuneApiError, getExecutionStatus } from "@/src/server/adapters/dune/client";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseExecutionId(raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new DuneApiError("executionId is required.", 400, false);
  }
  return value;
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
      event: "api.dune.status.rate_limited",
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
    const status = await getExecutionStatus(executionId);

    logApiInfo({
      event: "api.dune.status.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: { executionId, state: status.state },
    });

    const response = jsonSuccess({
      source: "dune",
      asOf: status.executionEndedAt ?? status.submittedAt ?? new Date().toISOString(),
      freshnessSec: 0,
      requestId,
      data: status,
      meta: {
        route: "/api/v1/dune/executions/:executionId/status",
        executionId,
        queryId: status.queryId,
      },
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const duneError = error as DuneApiError;
    logApiError({
      event: "api.dune.status.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: duneError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: duneError.message,
    });
    const response = jsonError({
      code: "DUNE_STATUS_FAILED",
      message: duneError.message || "Failed to fetch Dune execution status.",
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
