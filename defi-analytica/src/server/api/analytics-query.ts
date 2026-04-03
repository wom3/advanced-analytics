export type AnalyticsQueryMode = "live" | "demo";

export type ParsedAnalyticsQuery = {
  mode: AnalyticsQueryMode;
  interval: string;
  points: number;
  asset: string;
  chain: string;
};

type ParseAnalyticsQueryOptions = {
  defaultPoints?: number;
};

export class AnalyticsQueryParseError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "AnalyticsQueryParseError";
    this.status = 400;
  }
}

function parseMode(value: string | null): AnalyticsQueryMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "live") {
    return "live";
  }
  if (normalized === "demo") {
    return "demo";
  }
  throw new AnalyticsQueryParseError("mode must be one of: live, demo.");
}

function parseInterval(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "1h";
  if (!/^(\d+)([smhdw])$/.test(normalized)) {
    throw new AnalyticsQueryParseError("interval must match pattern like 1h, 6h, 1d, 7d.");
  }
  return normalized;
}

function parsePoints(value: string | null, defaultPoints: number): number {
  if (!value) {
    return defaultPoints;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 24 || numeric > 720) {
    throw new AnalyticsQueryParseError("points must be an integer between 24 and 720.");
  }
  return numeric;
}

function parseAsset(value: string | null): string {
  if (value === null) {
    return "bitcoin";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new AnalyticsQueryParseError("asset must be a non-empty asset slug.");
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new AnalyticsQueryParseError(
      "asset must contain only lowercase letters, numbers, and hyphens."
    );
  }
  return normalized;
}

function parseChain(value: string | null): string {
  if (value === null) {
    return "Ethereum";
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new AnalyticsQueryParseError("chain must be a non-empty chain name.");
  }
  return normalized;
}

export function parseAnalyticsQuery(
  searchParams: URLSearchParams,
  options?: ParseAnalyticsQueryOptions
): ParsedAnalyticsQuery {
  const defaultPoints = options?.defaultPoints ?? 72;

  return {
    mode: parseMode(searchParams.get("mode")),
    interval: parseInterval(searchParams.get("interval")),
    points: parsePoints(searchParams.get("points"), defaultPoints),
    asset: parseAsset(searchParams.get("asset")),
    chain: parseChain(searchParams.get("chain")),
  };
}