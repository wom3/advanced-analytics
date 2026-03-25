import type { NextRequest } from "next/server";

import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/src/server/api/envelope";
import { publicRateLimitKey, takeToken } from "@/src/server/api/rate-limit";
import { LlamaApiError } from "@/src/server/adapters/defillama/client";
import { getDefiLlamaDexCatalog } from "@/src/server/services/catalog/defillama";
import { logApiError, logApiInfo, logApiWarn } from "@/src/server/observability/logger";

function parseOptionalString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request.headers);
  const key = publicRateLimitKey(request);
  const rl = takeToken(key);
  const resetEpochSeconds = Math.floor(rl.resetAt / 1000);

  if (!rl.allowed) {
    logApiWarn({
      event: "api.llama.catalog.rate_limited",
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
    const chain = parseOptionalString(request.nextUrl.searchParams.get("chain"));
    const result = await getDefiLlamaDexCatalog(chain, requestId);
    const freshnessSec = Math.max(Math.floor((Date.now() - Date.parse(result.asOf)) / 1_000), 0);

    logApiInfo({
      event: "api.llama.catalog.success",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: 200,
      durationMs: Date.now() - startedAt,
      meta: {
        chain: result.catalog.activeChain,
        source: result.source,
        protocols: result.catalog.protocols.length,
      },
    });

    const response = jsonSuccess({
      source: result.source,
      asOf: result.asOf,
      freshnessSec,
      data: result.catalog,
      meta: {
        route: "/api/v1/llama/catalog",
        chain: result.catalog.activeChain,
      },
      requestId,
    });
    response.headers.set("x-ratelimit-remaining", String(rl.remaining));
    response.headers.set("x-ratelimit-reset", String(resetEpochSeconds));
    return response;
  } catch (error) {
    const llamaError = error as LlamaApiError;
    logApiError({
      event: "api.llama.catalog.error",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: llamaError.status ?? 500,
      durationMs: Date.now() - startedAt,
      message: llamaError.message,
    });

    const response = jsonError({
      code: "LLAMA_CATALOG_FAILED",
      message: llamaError.message || "Failed to fetch DefiLlama catalog data.",
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