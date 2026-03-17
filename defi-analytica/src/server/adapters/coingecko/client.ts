const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

export type CoinGeckoMarketPoint = {
  timestamp: string;
  price: number;
  marketCap: number;
  volume: number;
};

export type CoinGeckoNormalizedMarketSeries = {
  asset: string;
  vsCurrency: string;
  interval: string;
  points: CoinGeckoMarketPoint[];
};

type CoinGeckoSeriesOptions = {
  sinceSec?: number;
  untilSec?: number;
  interval?: string;
  vsCurrency?: string;
};

type CoinGeckoMarketChartRangePayload = {
  prices?: Array<[number, number]>;
  market_caps?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
};

type RawMarketPoint = {
  timestampSec: number;
  price: number;
  marketCap: number;
  volume: number;
};

export class CoinGeckoApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = true) {
    super(message);
    this.name = "CoinGeckoApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function parseIntervalSec(interval: string | undefined): number | null {
  if (!interval) {
    return null;
  }

  const normalized = interval.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d+)([smhdw])$/);
  if (!match || !match[2]) {
    throw new CoinGeckoApiError("interval must match pattern like 1h, 6h, 1d, 7d.", 400, false);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
    w: 604_800,
  };

  return amount * (multipliers[unit] ?? 0);
}

function toIso(timestampSec: number): string {
  return new Date(timestampSec * 1_000).toISOString();
}

function toSeriesMap(series: Array<[number, number]> | undefined): Map<number, number> {
  const points = new Map<number, number>();
  for (const point of series ?? []) {
    const timestampMs = Number(point[0] ?? Number.NaN);
    const value = Number(point[1] ?? Number.NaN);
    if (!Number.isFinite(timestampMs) || !Number.isFinite(value)) {
      continue;
    }
    const timestampSec = Math.floor(timestampMs / 1_000);
    points.set(timestampSec, value);
  }
  return points;
}

function coingeckoIntervalParam(intervalSec: number | null): "hourly" | "daily" | undefined {
  if (intervalSec === 3_600) {
    return "hourly";
  }
  if (intervalSec === 86_400) {
    return "daily";
  }
  return undefined;
}

function sanitizeAndResample(
  points: RawMarketPoint[],
  options: {
    sinceSec: number;
    untilSec: number;
    intervalSec: number | null;
  }
): CoinGeckoMarketPoint[] {
  const filtered = points
    .filter((point) => {
      if (point.timestampSec < options.sinceSec || point.timestampSec > options.untilSec) {
        return false;
      }
      return (
        Number.isFinite(point.timestampSec) &&
        Number.isFinite(point.price) &&
        Number.isFinite(point.marketCap) &&
        Number.isFinite(point.volume)
      );
    })
    .sort((left, right) => left.timestampSec - right.timestampSec);

  if (!options.intervalSec || options.intervalSec <= 0) {
    return filtered.map((point) => ({
      timestamp: toIso(point.timestampSec),
      price: point.price,
      marketCap: point.marketCap,
      volume: point.volume,
    }));
  }

  const buckets = new Map<number, RawMarketPoint>();
  for (const point of filtered) {
    const bucketStart = Math.floor(point.timestampSec / options.intervalSec) * options.intervalSec;
    buckets.set(bucketStart, point);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, point]) => ({
      timestamp: toIso(point.timestampSec),
      price: point.price,
      marketCap: point.marketCap,
      volume: point.volume,
    }));
}

async function coinGeckoRequest<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    query.set(key, String(value));
  }

  const url = `${COINGECKO_BASE_URL}${path}?${query.toString()}`;

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
    throw new CoinGeckoApiError(
      isTimeout
        ? "CoinGecko request timed out before a response was received."
        : "Failed to reach CoinGecko due to a network error.",
      isTimeout ? 504 : 502,
      true
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CoinGeckoApiError(
      `CoinGecko returned a non-JSON response with status ${response.status}.`,
      response.status,
      response.status >= 500
    );
  }

  if (!response.ok) {
    const maybeMessage =
      typeof payload === "object" && payload !== null && "status" in payload
        ? String(
            ((payload as { status?: { error_message?: unknown } }).status?.error_message as
              | string
              | undefined) ?? ""
          )
        : "";
    throw new CoinGeckoApiError(
      maybeMessage || `CoinGecko API request failed with status ${response.status}.`,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  return payload as T;
}

export async function getCoinGeckoMarketSeries(
  asset: string,
  options?: CoinGeckoSeriesOptions
): Promise<CoinGeckoNormalizedMarketSeries> {
  const intervalSec = parseIntervalSec(options?.interval);
  const nowSec = Math.floor(Date.now() / 1_000);
  const untilSec = options?.untilSec ?? nowSec;

  let sinceSec: number;
  if (options?.sinceSec !== undefined) {
    sinceSec = options.sinceSec;
  } else {
    const defaultSinceSec = untilSec - 30 * 86_400;
    sinceSec = defaultSinceSec < 0 ? 0 : defaultSinceSec;
  }

  if (sinceSec < 0 || untilSec < 0) {
    throw new CoinGeckoApiError(
      "since and until must be non-negative Unix timestamps.",
      400,
      false
    );
  }

  if (sinceSec > untilSec) {
    throw new CoinGeckoApiError("since must be less than or equal to until.", 400, false);
  }

  const vsCurrency = options?.vsCurrency?.trim().toLowerCase() || "usd";

  const payload = await coinGeckoRequest<CoinGeckoMarketChartRangePayload>(
    `/coins/${encodeURIComponent(asset)}/market_chart/range`,
    {
      vs_currency: vsCurrency,
      from: sinceSec,
      to: untilSec,
      interval: coingeckoIntervalParam(intervalSec),
    }
  );

  const priceByTs = toSeriesMap(payload.prices);
  const marketCapByTs = toSeriesMap(payload.market_caps);
  const volumeByTs = toSeriesMap(payload.total_volumes);

  const timestamps = new Set<number>([
    ...priceByTs.keys(),
    ...marketCapByTs.keys(),
    ...volumeByTs.keys(),
  ]);

  const rawPoints: RawMarketPoint[] = [...timestamps].map((timestampSec) => ({
    timestampSec,
    price: Number(priceByTs.get(timestampSec) ?? Number.NaN),
    marketCap: Number(marketCapByTs.get(timestampSec) ?? Number.NaN),
    volume: Number(volumeByTs.get(timestampSec) ?? Number.NaN),
  }));

  const points = sanitizeAndResample(rawPoints, {
    sinceSec,
    untilSec,
    intervalSec,
  });

  return {
    asset,
    vsCurrency,
    interval: options?.interval ?? "raw",
    points,
  };
}
