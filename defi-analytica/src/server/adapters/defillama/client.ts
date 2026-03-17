const LLAMA_BASE_URL = "https://api.llama.fi";

export type LlamaMetric = "tvl" | "volume" | "fees" | "perps";

export type LlamaTimeSeriesPoint = {
  timestamp: string;
  value: number;
};

export type LlamaNormalizedSeries = {
  metric: LlamaMetric;
  chain: string | null;
  protocol: string | null;
  interval: string;
  points: LlamaTimeSeriesPoint[];
};

type LlamaSeriesOptions = {
  chain?: string;
  protocol?: string;
  sinceSec?: number;
  untilSec?: number;
  interval?: string;
};

type LlamaOverviewPayload = {
  totalDataChart?: Array<[number, number]>;
};

type LlamaProtocolChainTvlEntry = {
  tvl?: Array<{ date?: number; totalLiquidityUSD?: number }>;
};

type LlamaProtocolPayload = {
  tvl?: Array<{ date?: number; totalLiquidityUSD?: number }>;
  chainTvls?: Record<string, LlamaProtocolChainTvlEntry>;
};

type LlamaHistoricalChainPoint = {
  date?: number;
  tvl?: number | Record<string, number>;
};

type RawPoint = {
  timestampSec: number;
  value: number;
};

export class LlamaApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = true) {
    super(message);
    this.name = "LlamaApiError";
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
    throw new LlamaApiError("interval must match pattern like 1h, 6h, 1d, 7d.", 400, false);
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

function sanitizeRawPoints(
  points: RawPoint[],
  options: {
    sinceSec?: number | undefined;
    untilSec?: number | undefined;
    intervalSec?: number | null;
  }
): LlamaTimeSeriesPoint[] {
  const filtered = points
    .filter((point) => {
      if (!Number.isFinite(point.timestampSec) || !Number.isFinite(point.value)) {
        return false;
      }
      if (options.sinceSec !== undefined && point.timestampSec < options.sinceSec) {
        return false;
      }
      if (options.untilSec !== undefined && point.timestampSec > options.untilSec) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.timestampSec - right.timestampSec);

  if (!options.intervalSec || options.intervalSec <= 0) {
    return filtered.map((point) => ({
      timestamp: toIso(point.timestampSec),
      value: point.value,
    }));
  }

  const buckets = new Map<number, RawPoint>();
  for (const point of filtered) {
    const bucketStart = Math.floor(point.timestampSec / options.intervalSec) * options.intervalSec;
    buckets.set(bucketStart, point);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, point]) => ({
      timestamp: toIso(point.timestampSec),
      value: point.value,
    }));
}

async function llamaRequest<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${LLAMA_BASE_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const err = error as Error & { name?: string };
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new LlamaApiError(
      isTimeout
        ? "DefiLlama request timed out before a response was received."
        : "Failed to reach DefiLlama due to a network error.",
      isTimeout ? 504 : 502,
      true
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LlamaApiError(
      `DefiLlama returned a non-JSON response with status ${response.status}.`,
      response.status,
      response.status >= 500
    );
  }

  if (!response.ok) {
    const maybeMessage =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "")
        : "";
    throw new LlamaApiError(
      maybeMessage || `DefiLlama API request failed with status ${response.status}.`,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  return payload as T;
}

function protocolChainMatches(chainKey: string, requestedChain: string): boolean {
  const normalizedKey = chainKey.toLowerCase().split("-")[0] ?? "";
  const normalizedRequested = requestedChain.toLowerCase();
  return normalizedKey === normalizedRequested;
}

function extractTvlFromProtocol(payload: LlamaProtocolPayload, chain?: string): RawPoint[] {
  if (!chain && Array.isArray(payload.tvl) && payload.tvl.length > 0) {
    return payload.tvl
      .map((point) => ({
        timestampSec: Number(point.date ?? 0),
        value: Number(point.totalLiquidityUSD ?? Number.NaN),
      }))
      .filter((point) => Number.isFinite(point.timestampSec) && Number.isFinite(point.value));
  }

  if (!payload.chainTvls) {
    throw new LlamaApiError("DefiLlama protocol response missing chain TVL data.", 502, true);
  }

  const matchedEntries = Object.entries(payload.chainTvls).filter(([key]) =>
    chain ? protocolChainMatches(key, chain) : true
  );

  if (matchedEntries.length === 0) {
    throw new LlamaApiError(`No chain TVL data found for chain '${chain}'.`, 404, false);
  }

  const byTimestamp = new Map<number, number>();

  for (const [, entry] of matchedEntries) {
    for (const point of entry.tvl ?? []) {
      const timestampSec = Number(point.date ?? Number.NaN);
      const value = Number(point.totalLiquidityUSD ?? Number.NaN);
      if (!Number.isFinite(timestampSec) || !Number.isFinite(value)) {
        continue;
      }
      byTimestamp.set(timestampSec, (byTimestamp.get(timestampSec) ?? 0) + value);
    }
  }

  return [...byTimestamp.entries()].map(([timestampSec, value]) => ({
    timestampSec,
    value,
  }));
}

function extractTvlFromHistoricalChain(
  rows: LlamaHistoricalChainPoint[],
  requestedChain?: string
): RawPoint[] {
  return rows
    .map((row) => {
      const timestampSec = Number(row.date ?? Number.NaN);
      let value: number;

      if (typeof row.tvl === "number") {
        value = row.tvl;
      } else if (row.tvl && typeof row.tvl === "object") {
        if (requestedChain) {
          const match = Object.entries(row.tvl).find(
            ([chainKey]) => chainKey.toLowerCase() === requestedChain.toLowerCase()
          );
          value = Number(match?.[1] ?? Number.NaN);
        } else {
          value = Object.values(row.tvl).reduce((sum, current) => {
            const numeric = Number(current);
            return Number.isFinite(numeric) ? sum + numeric : sum;
          }, 0);
        }
      } else {
        value = Number.NaN;
      }

      return { timestampSec, value };
    })
    .filter((point) => Number.isFinite(point.timestampSec) && Number.isFinite(point.value));
}

async function loadTvlSeries(options: LlamaSeriesOptions): Promise<RawPoint[]> {
  if (options.protocol) {
    const payload = await llamaRequest<LlamaProtocolPayload>(
      `/protocol/${encodeURIComponent(options.protocol)}`
    );
    return extractTvlFromProtocol(payload, options.chain);
  }

  const path = options.chain
    ? `/v2/historicalChainTvl/${encodeURIComponent(options.chain)}`
    : "/v2/historicalChainTvl";
  const payload = await llamaRequest<LlamaHistoricalChainPoint[]>(path);
  return extractTvlFromHistoricalChain(payload, options.chain);
}

function overviewPath(metric: Exclude<LlamaMetric, "tvl">, options: LlamaSeriesOptions): string {
  const resource = metric === "volume" ? "dexs" : metric === "fees" ? "fees" : "open-interest";
  if (options.protocol) {
    return `/summary/${resource}/${encodeURIComponent(options.protocol)}`;
  }
  if (options.chain) {
    return `/overview/${resource}/${encodeURIComponent(options.chain)}`;
  }
  return `/overview/${resource}`;
}

async function loadOverviewSeries(
  metric: Exclude<LlamaMetric, "tvl">,
  options: LlamaSeriesOptions
): Promise<RawPoint[]> {
  const payload = await llamaRequest<LlamaOverviewPayload>(overviewPath(metric, options));
  if (!Array.isArray(payload.totalDataChart)) {
    throw new LlamaApiError("DefiLlama response missing totalDataChart series.", 502, true);
  }

  return payload.totalDataChart
    .map((point) => ({
      timestampSec: Number(point[0] ?? Number.NaN),
      value: Number(point[1] ?? Number.NaN),
    }))
    .filter((point) => Number.isFinite(point.timestampSec) && Number.isFinite(point.value));
}

export async function getLlamaMetricSeries(
  metric: LlamaMetric,
  options: LlamaSeriesOptions
): Promise<LlamaNormalizedSeries> {
  const intervalSec = parseIntervalSec(options.interval);

  const rawPoints =
    metric === "tvl" ? await loadTvlSeries(options) : await loadOverviewSeries(metric, options);

  const points = sanitizeRawPoints(rawPoints, {
    sinceSec: options.sinceSec,
    untilSec: options.untilSec,
    intervalSec,
  });

  return {
    metric,
    chain: options.chain ?? null,
    protocol: options.protocol ?? null,
    interval: options.interval ?? "raw",
    points,
  };
}
