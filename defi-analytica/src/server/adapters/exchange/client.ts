const BINANCE_BASE_URL = "https://api.binance.com";
const SECONDS_PER_YEAR = 31_536_000;

export const BINANCE_MAX_LIMIT = 1_000;
export const BINANCE_DEFAULT_LIMIT = 500;

const SUPPORTED_INTERVALS = new Set([
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

export type ExchangeMicrostructurePoint = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  momentum: number | null;
  realizedVolatility: number | null;
};

export type ExchangeMicrostructureSeries = {
  venue: "binance";
  symbol: string;
  interval: string;
  points: ExchangeMicrostructurePoint[];
};

type ExchangeSeriesOptions = {
  interval?: string;
  sinceSec?: number;
  untilSec?: number;
  limit?: number;
};

type BinanceApiErrorPayload = {
  msg?: string;
};

type RawKlinePoint = {
  timestampSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
};

export class ExchangeApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = true) {
    super(message);
    this.name = "ExchangeApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function toIso(timestampSec: number): string {
  return new Date(timestampSec * 1_000).toISOString();
}

function parseIntervalSec(interval: string): number {
  const value = interval.trim();
  const match = value.match(/^(\d+)([smhdwM])$/);
  if (!match || !match[2]) {
    throw new ExchangeApiError(
      "interval must be one of Binance kline intervals (e.g. 1m, 15m, 1h, 1d, 1w, 1M).",
      400,
      false
    );
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ExchangeApiError("interval must have a positive numeric amount.", 400, false);
  }

  const unit = match[2];
  const unitSeconds =
    unit === "s"
      ? 1
      : unit === "m"
        ? 60
        : unit === "h"
          ? 3_600
          : unit === "d"
            ? 86_400
            : unit === "w"
              ? 604_800
              : 2_592_000;

  return amount * unitSeconds;
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? BINANCE_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > BINANCE_MAX_LIMIT) {
    throw new ExchangeApiError(
      `limit must be an integer between 1 and ${BINANCE_MAX_LIMIT}.`,
      400,
      false
    );
  }
  return limit;
}

function parseSymbol(raw: string): string {
  const symbol = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    throw new ExchangeApiError(
      "symbol must be 5-20 characters and contain only A-Z and 0-9.",
      400,
      false
    );
  }
  return symbol;
}

async function binanceRequest(
  path: string,
  params: Record<string, string | number>
): Promise<unknown> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }

  const url = `${BINANCE_BASE_URL}${path}?${query.toString()}`;

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
    throw new ExchangeApiError(
      isTimeout
        ? "Exchange request timed out before a response was received."
        : "Failed to reach exchange market data provider due to a network error.",
      isTimeout ? 504 : 502,
      true
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ExchangeApiError(
      `Exchange provider returned a non-JSON response with status ${response.status}.`,
      response.status,
      response.status >= 500
    );
  }

  if (!response.ok) {
    const maybeMessage =
      typeof payload === "object" && payload !== null
        ? String((payload as BinanceApiErrorPayload).msg ?? "")
        : "";
    throw new ExchangeApiError(
      maybeMessage || `Exchange provider request failed with status ${response.status}.`,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  return payload;
}

function parseRawKlines(payload: unknown): RawKlinePoint[] {
  if (!Array.isArray(payload)) {
    throw new ExchangeApiError("Exchange provider response had unexpected shape.", 502, true);
  }

  const points: RawKlinePoint[] = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 9) {
      continue;
    }

    const openTimeMs = Number(row[0] ?? Number.NaN);
    const open = Number(row[1] ?? Number.NaN);
    const high = Number(row[2] ?? Number.NaN);
    const low = Number(row[3] ?? Number.NaN);
    const close = Number(row[4] ?? Number.NaN);
    const volume = Number(row[5] ?? Number.NaN);
    const quoteVolume = Number(row[7] ?? Number.NaN);
    const trades = Number(row[8] ?? Number.NaN);

    if (
      !Number.isFinite(openTimeMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume) ||
      !Number.isFinite(quoteVolume) ||
      !Number.isFinite(trades)
    ) {
      continue;
    }

    points.push({
      timestampSec: Math.floor(openTimeMs / 1_000),
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      trades: Math.max(Math.floor(trades), 0),
    });
  }

  return points.sort((left, right) => left.timestampSec - right.timestampSec);
}

function computeSeries(
  points: RawKlinePoint[],
  intervalSec: number
): ExchangeMicrostructurePoint[] {
  const annualization = Math.sqrt(SECONDS_PER_YEAR / Math.max(intervalSec, 1));
  const momentumWindow = 10;
  const volatilityWindow = 20;

  return points.map((point, index) => {
    let momentum: number | null = null;
    if (index >= momentumWindow && points[index - momentumWindow]) {
      const base = points[index - momentumWindow].close;
      if (base > 0) {
        momentum = point.close / base - 1;
      }
    }

    let realizedVolatility: number | null = null;
    const returnCount = Math.min(volatilityWindow, index);
    if (returnCount > 0) {
      let sumSquares = 0;
      let validReturns = 0;

      for (let cursor = index - returnCount + 1; cursor <= index; cursor += 1) {
        const previous = points[cursor - 1];
        const current = points[cursor];
        if (!previous || !current || previous.close <= 0 || current.close <= 0) {
          continue;
        }

        const logReturn = Math.log(current.close / previous.close);
        if (Number.isFinite(logReturn)) {
          sumSquares += logReturn * logReturn;
          validReturns += 1;
        }
      }

      if (validReturns > 0) {
        realizedVolatility = Math.sqrt(sumSquares / validReturns) * annualization;
      }
    }

    return {
      timestamp: toIso(point.timestampSec),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
      quoteVolume: point.quoteVolume,
      trades: point.trades,
      momentum,
      realizedVolatility,
    };
  });
}

export async function getExchangeMicrostructureSeries(
  rawSymbol: string,
  options?: ExchangeSeriesOptions
): Promise<ExchangeMicrostructureSeries> {
  const symbol = parseSymbol(rawSymbol);
  const interval = (options?.interval ?? "1h").trim();

  if (!SUPPORTED_INTERVALS.has(interval)) {
    throw new ExchangeApiError(
      "interval is not supported by Binance klines. Use values like 1m, 5m, 15m, 1h, 1d, 1w, 1M.",
      400,
      false
    );
  }

  const intervalSec = parseIntervalSec(interval);
  const limit = parseLimit(options?.limit);

  const nowSec = Math.floor(Date.now() / 1_000);
  const untilSec = options?.untilSec ?? nowSec;
  const defaultWindowSec = limit * intervalSec;
  const sinceSec = options?.sinceSec ?? Math.max(untilSec - defaultWindowSec, 0);

  if (sinceSec < 0 || untilSec < 0) {
    throw new ExchangeApiError("since and until must be non-negative unix timestamps.", 400, false);
  }

  if (sinceSec > untilSec) {
    throw new ExchangeApiError("since must be less than or equal to until.", 400, false);
  }

  const payload = await binanceRequest("/api/v3/klines", {
    symbol,
    interval,
    startTime: sinceSec * 1_000,
    endTime: untilSec * 1_000,
    limit,
  });

  const rawPoints = parseRawKlines(payload).filter(
    (point) => point.timestampSec >= sinceSec && point.timestampSec <= untilSec
  );

  return {
    venue: "binance",
    symbol,
    interval,
    points: computeSeries(rawPoints, intervalSec),
  };
}
