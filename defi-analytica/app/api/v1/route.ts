import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import { logApiInfo, logApiWarn } from "@/src/server/observability/logger";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.v1.rate_limited",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 429,
      durationMs: Date.now() - startedAt,
      meta: { retryAfterSec: rl.retryAfterSec },
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

  logApiInfo({
    event: "api.v1.root",
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    status: 200,
    durationMs: Date.now() - startedAt,
  });

  const response = jsonSuccess({
    source: "internal",
    freshnessSec: 0,
    requestId,
    data: {
      service: "advanced-analytics-api",
      version: "v1",
      status: "ok",
      endpoints: ["/api/v1", "/api/v1/llama/metrics/:metric"],
    },
    meta: {
      route: "/api/v1",
    },
  });
  response.headers.set("x-ratelimit-remaining", String(rl.remaining));
  response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
  return response;
}
