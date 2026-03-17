const ALTERNATIVE_BASE_URL = "https://api.alternative.me";
const ALTERNATIVE_DEFAULT_LIMIT = 100;
export const ALTERNATIVE_MAX_LIMIT = 1_000;

export const ALTERNATIVE_ATTRIBUTION = {
  provider: "alternative.me",
  url: "https://alternative.me/crypto/fear-and-greed-index/",
};

type AlternativeApiPayload = {
  name?: string;
  data?: Array<{
    value?: string;
    value_classification?: string;
    timestamp?: string;
    time_until_update?: string;
  }>;
  metadata?: {
    error?: string | null;
  };
};

type AlternativeApiPoint = NonNullable<AlternativeApiPayload["data"]>[number];

export type AlternativeFngPoint = {
  timestamp: string;
  value: number;
  classification: string;
  timeUntilUpdateSec: number | null;
};

type ParsedAlternativeFngPoint = AlternativeFngPoint & {
  timestampSec: number;
};

export class AlternativeApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = true) {
    super(message);
    this.name = "AlternativeApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function toIso(timestampSec: number): string {
  return new Date(timestampSec * 1_000).toISOString();
}

function parsePoint(raw: AlternativeApiPoint): ParsedAlternativeFngPoint | null {
  const value = Number(raw?.value ?? Number.NaN);
  const timestampSec = Number(raw?.timestamp ?? Number.NaN);
  const classification = raw?.value_classification?.trim() ?? "";

  if (!Number.isFinite(value) || !Number.isFinite(timestampSec) || !classification) {
    return null;
  }

  const timeUntilUpdateSecRaw = Number(raw?.time_until_update ?? Number.NaN);
  const timeUntilUpdateSec = Number.isFinite(timeUntilUpdateSecRaw)
    ? Math.max(Math.floor(timeUntilUpdateSecRaw), 0)
    : null;

  return {
    timestampSec,
    timestamp: toIso(timestampSec),
    value,
    classification,
    timeUntilUpdateSec,
  };
}

function toPublicPoint(point: ParsedAlternativeFngPoint): AlternativeFngPoint {
  return {
    timestamp: point.timestamp,
    value: point.value,
    classification: point.classification,
    timeUntilUpdateSec: point.timeUntilUpdateSec,
  };
}

async function alternativeRequest(limit: number): Promise<AlternativeApiPayload> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AlternativeApiError("limit must be a positive integer.", 400, false);
  }

  const cappedLimit = Math.min(limit, ALTERNATIVE_MAX_LIMIT);
  const url = `${ALTERNATIVE_BASE_URL}/fng/?limit=${cappedLimit}&format=json`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const err = error as Error & { name?: string };
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AlternativeApiError(
      isTimeout
        ? "Alternative.me request timed out before a response was received."
        : "Failed to reach Alternative.me due to a network error.",
      isTimeout ? 504 : 502,
      true
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AlternativeApiError(
      `Alternative.me returned a non-JSON response with status ${response.status}.`,
      response.status,
      response.status >= 500
    );
  }

  if (!response.ok) {
    throw new AlternativeApiError(
      `Alternative.me API request failed with status ${response.status}.`,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  const typedPayload = payload as AlternativeApiPayload;
  if (typedPayload.metadata?.error) {
    throw new AlternativeApiError(
      `Alternative.me API error: ${typedPayload.metadata.error}`,
      502,
      true
    );
  }

  return typedPayload;
}

export async function getFearGreedLatest(): Promise<AlternativeFngPoint> {
  const payload = await alternativeRequest(1);
  const parsed = (payload.data ?? [])
    .map(parsePoint)
    .filter(Boolean) as ParsedAlternativeFngPoint[];

  if (parsed.length === 0) {
    throw new AlternativeApiError(
      "Alternative.me latest response did not include valid data.",
      502,
      true
    );
  }

  return toPublicPoint(parsed[0]);
}

export async function getFearGreedHistory(options?: {
  limit?: number;
  sinceSec?: number;
  untilSec?: number;
}): Promise<AlternativeFngPoint[]> {
  const limit = options?.limit ?? ALTERNATIVE_DEFAULT_LIMIT;
  const payload = await alternativeRequest(limit);
  const points = (payload.data ?? [])
    .map(parsePoint)
    .filter(Boolean) as ParsedAlternativeFngPoint[];

  const sinceSec = options?.sinceSec;
  const untilSec = options?.untilSec;

  return points
    .filter((point) => {
      if (sinceSec !== undefined && point.timestampSec < sinceSec) {
        return false;
      }
      if (untilSec !== undefined && point.timestampSec > untilSec) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.timestampSec - right.timestampSec)
    .map(toPublicPoint);
}
