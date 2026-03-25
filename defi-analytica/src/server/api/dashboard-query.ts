export type DashboardQueryMode = "live" | "demo";

export type ParsedDashboardQuery = {
  mode: DashboardQueryMode;
  interval: string;
  points: number;
  asset: string;
  chain: string;
};

type ParseDashboardQueryOptions = {
  defaultPoints?: number;
};

export class DashboardQueryParseError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "DashboardQueryParseError";
    this.status = 400;
  }
}

function parseMode(value: string | null): DashboardQueryMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "live") {
    return "live";
  }
  if (normalized === "demo") {
    return "demo";
  }
  throw new DashboardQueryParseError("mode must be one of: live, demo.");
}

function parseInterval(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "1h";
  if (!/^(\d+)([smhdw])$/.test(normalized)) {
    throw new DashboardQueryParseError("interval must match pattern like 1h, 6h, 1d, 7d.");
  }
  return normalized;
}

function parsePoints(value: string | null, defaultPoints: number): number {
  if (!value) {
    return defaultPoints;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 24 || numeric > 720) {
    throw new DashboardQueryParseError("points must be an integer between 24 and 720.");
  }
  return numeric;
}

function parseAsset(value: string | null): string {
  if (value === null) {
    return "bitcoin";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new DashboardQueryParseError("asset must be a non-empty asset slug.");
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new DashboardQueryParseError(
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
    throw new DashboardQueryParseError("chain must be a non-empty chain name.");
  }
  return normalized;
}

export function parseDashboardQuery(
  searchParams: URLSearchParams,
  options?: ParseDashboardQueryOptions
): ParsedDashboardQuery {
  const defaultPoints = options?.defaultPoints ?? 72;

  return {
    mode: parseMode(searchParams.get("mode")),
    interval: parseInterval(searchParams.get("interval")),
    points: parsePoints(searchParams.get("points"), defaultPoints),
    asset: parseAsset(searchParams.get("asset")),
    chain: parseChain(searchParams.get("chain")),
  };
}