import {
  getFearGreedHistory,
  type AlternativeFngPoint,
} from "@/src/server/adapters/alternative/client";
import {
  getCoinGeckoMarketSeries,
  type CoinGeckoMarketPoint,
} from "@/src/server/adapters/coingecko/client";
import {
  getLlamaMetricSeries,
  type LlamaTimeSeriesPoint,
} from "@/src/server/adapters/defillama/client";
import {
  engineerFeatureTable,
  type FeatureFactorInput,
} from "@/src/server/services/feature-engineering/service";
import {
  scoreSentimentFromFeatureTable,
  scoreSentimentHistoryFromFeatureTable,
  type SentimentHistoryPoint,
  type SentimentScoreResult,
} from "@/src/server/services/sentiment-scoring/service";

export type SentimentBuildMode = "live" | "demo";

export type SentimentBuildOptions = {
  mode?: SentimentBuildMode;
  asset?: string;
  chain?: string;
  interval?: string;
  points?: number;
};

export type ProviderStatus = {
  provider: "coingecko" | "defillama" | "alternative";
  ok: boolean;
  fallback: boolean;
  latencyMs: number;
  points: number;
  asOf: string | null;
  error?: string;
};

export type DashboardOverviewResult = {
  asOf: string;
  freshnessSec: number;
  score: SentimentScoreResult;
  history: SentimentHistoryPoint[];
  providerStatus: ProviderStatus[];
  featureFactorIds: string[];
  market: {
    asset: string;
    latestPrice: number | null;
    latestVolume: number | null;
    priceChangePct24h: number | null;
  };
  anchors: {
    fearGreedValue: number | null;
    fearGreedClassification: string | null;
  };
};

type TimedResult<T> = {
  ok: boolean;
  latencyMs: number;
  data: T | null;
  error?: string;
};

function parseIntervalSec(interval: string): number {
  const normalized = interval.trim().toLowerCase();
  const match = normalized.match(/^(\d+)([smhdw])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error("interval must match pattern like 1h, 6h, 1d, 7d.");
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

function clampPoints(points: number): number {
  return Math.min(Math.max(Math.floor(points), 24), 720);
}

function toIso(timestampSec: number): string {
  return new Date(timestampSec * 1_000).toISOString();
}

function buildSyntheticTimeline(intervalSec: number, points: number): string[] {
  const nowSec = Math.floor(Date.now() / 1_000);
  const list: string[] = [];

  for (let index = points - 1; index >= 0; index -= 1) {
    list.push(toIso(nowSec - index * intervalSec));
  }

  return list;
}

function buildSyntheticFactors(timeline: string[]): FeatureFactorInput[] {
  const cgVolume = timeline.map((timestamp, index) => ({
    timestamp,
    value: 12 + Math.sin(index / 5) * 1.5 + index * 0.015,
  }));

  const cgPriceMomentum = timeline.map((timestamp, index) => ({
    timestamp,
    value: Math.sin(index / 9) * 0.6 + 0.05,
  }));

  const llamaTvlMomentum = timeline.map((timestamp, index) => ({
    timestamp,
    value: Math.cos(index / 11) * 0.45 + 0.08,
  }));

  const fngIndex = timeline.map((timestamp, index) => ({
    timestamp,
    value: 50 + Math.sin(index / 7) * 15,
  }));

  return [
    {
      factorId: "cg_volume_regime",
      source: "coingecko",
      points: cgVolume,
    },
    {
      factorId: "cg_price_momentum",
      source: "coingecko",
      points: cgPriceMomentum,
    },
    {
      factorId: "llama_tvl_momentum",
      source: "defillama",
      points: llamaTvlMomentum,
    },
    {
      factorId: "fng_index",
      source: "alternative",
      points: fngIndex,
    },
  ];
}

function toMomentumPoints(points: Array<{ timestamp: string; value: number }>): Array<{
  timestamp: string;
  value: number;
}> {
  return points.map((point, index) => {
    if (index === 0) {
      return {
        timestamp: point.timestamp,
        value: 0,
      };
    }

    const previous = points[index - 1];
    if (!previous || previous.value === 0) {
      return {
        timestamp: point.timestamp,
        value: 0,
      };
    }

    return {
      timestamp: point.timestamp,
      value: (point.value - previous.value) / Math.abs(previous.value),
    };
  });
}

function mapCoinGeckoFactors(points: CoinGeckoMarketPoint[]): FeatureFactorInput[] {
  const volumePoints = points.map((point) => ({
    timestamp: point.timestamp,
    value: Math.log10(Math.max(point.volume, 0) + 1),
  }));

  const priceBase = points.map((point) => ({
    timestamp: point.timestamp,
    value: point.price,
  }));

  return [
    {
      factorId: "cg_volume_regime",
      source: "coingecko",
      points: volumePoints,
    },
    {
      factorId: "cg_price_momentum",
      source: "coingecko",
      points: toMomentumPoints(priceBase),
    },
  ];
}

function mapLlamaFactor(points: LlamaTimeSeriesPoint[]): FeatureFactorInput {
  const base = points.map((point) => ({
    timestamp: point.timestamp,
    value: point.value,
  }));

  return {
    factorId: "llama_tvl_momentum",
    source: "defillama",
    points: toMomentumPoints(base),
  };
}

function mapFngFactor(points: AlternativeFngPoint[]): FeatureFactorInput {
  return {
    factorId: "fng_index",
    source: "alternative",
    points: points.map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
    })),
  };
}

async function measureProviderCall<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const startedAt = Date.now();
  try {
    const data = await fn();
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      data: null,
      error: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

function extractAsOfFromFactor(factor: FeatureFactorInput): string | null {
  const latest = factor.points[factor.points.length - 1];
  return latest?.timestamp ?? null;
}

function estimatePriceChangePct24h(points: CoinGeckoMarketPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }

  const latest = points[points.length - 1];
  if (!latest) {
    return null;
  }

  const latestMs = Date.parse(latest.timestamp);
  if (!Number.isFinite(latestMs)) {
    return null;
  }

  const threshold = latestMs - 24 * 3_600 * 1_000;
  let anchor = points[0] ?? null;

  for (const point of points) {
    const pointMs = Date.parse(point.timestamp);
    if (!Number.isFinite(pointMs)) {
      continue;
    }
    if (pointMs >= threshold) {
      anchor = point;
      break;
    }
  }

  if (!anchor || anchor.price === 0) {
    return null;
  }

  return Number((((latest.price - anchor.price) / Math.abs(anchor.price)) * 100).toFixed(4));
}

export async function buildDashboardOverview(
  options?: SentimentBuildOptions
): Promise<DashboardOverviewResult> {
  const mode: SentimentBuildMode = options?.mode ?? "live";
  const asset = (options?.asset ?? "bitcoin").trim().toLowerCase();
  const chain = (options?.chain ?? "Ethereum").trim();
  const interval = (options?.interval ?? "1h").trim();
  const intervalSec = parseIntervalSec(interval);
  const points = clampPoints(options?.points ?? 72);

  const untilSec = Math.floor(Date.now() / 1_000);
  const sinceSec = Math.max(untilSec - (points - 1) * intervalSec, 0);
  const syntheticTimeline = buildSyntheticTimeline(intervalSec, points);
  const syntheticFactors = buildSyntheticFactors(syntheticTimeline);

  const providerStatus: ProviderStatus[] = [];
  const factors: FeatureFactorInput[] = [];

  let marketPoints: CoinGeckoMarketPoint[] = [];
  let fngPoints: AlternativeFngPoint[] = [];

  if (mode === "live") {
    const [coingeckoResult, llamaResult, fngResult] = await Promise.all([
      measureProviderCall(() =>
        getCoinGeckoMarketSeries(asset, {
          sinceSec,
          untilSec,
          interval,
        })
      ),
      measureProviderCall(() =>
        getLlamaMetricSeries("tvl", {
          chain,
          sinceSec,
          untilSec,
          interval,
        })
      ),
      measureProviderCall(() =>
        getFearGreedHistory({
          limit: points,
          sinceSec,
          untilSec,
        })
      ),
    ]);

    if (coingeckoResult.ok && coingeckoResult.data) {
      marketPoints = coingeckoResult.data.points;
      factors.push(...mapCoinGeckoFactors(coingeckoResult.data.points));
      providerStatus.push({
        provider: "coingecko",
        ok: true,
        fallback: false,
        latencyMs: coingeckoResult.latencyMs,
        points: coingeckoResult.data.points.length,
        asOf: coingeckoResult.data.points.at(-1)?.timestamp ?? null,
      });
    } else {
      factors.push(syntheticFactors[0]!, syntheticFactors[1]!);
      providerStatus.push({
        provider: "coingecko",
        ok: false,
        fallback: true,
        latencyMs: coingeckoResult.latencyMs,
        points: syntheticFactors[0]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[0]!),
        ...(coingeckoResult.error ? { error: coingeckoResult.error } : {}),
      });
    }

    if (llamaResult.ok && llamaResult.data) {
      const llamaFactor = mapLlamaFactor(llamaResult.data.points);
      factors.push(llamaFactor);
      providerStatus.push({
        provider: "defillama",
        ok: true,
        fallback: false,
        latencyMs: llamaResult.latencyMs,
        points: llamaResult.data.points.length,
        asOf: llamaResult.data.points.at(-1)?.timestamp ?? null,
      });
    } else {
      factors.push(syntheticFactors[2]!);
      providerStatus.push({
        provider: "defillama",
        ok: false,
        fallback: true,
        latencyMs: llamaResult.latencyMs,
        points: syntheticFactors[2]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[2]!),
        ...(llamaResult.error ? { error: llamaResult.error } : {}),
      });
    }

    if (fngResult.ok && fngResult.data) {
      fngPoints = fngResult.data;
      const fngFactor = mapFngFactor(fngResult.data);
      factors.push(fngFactor);
      providerStatus.push({
        provider: "alternative",
        ok: true,
        fallback: false,
        latencyMs: fngResult.latencyMs,
        points: fngResult.data.length,
        asOf: fngResult.data.at(-1)?.timestamp ?? null,
      });
    } else {
      factors.push(syntheticFactors[3]!);
      providerStatus.push({
        provider: "alternative",
        ok: false,
        fallback: true,
        latencyMs: fngResult.latencyMs,
        points: syntheticFactors[3]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[3]!),
        ...(fngResult.error ? { error: fngResult.error } : {}),
      });
    }
  } else {
    factors.push(...syntheticFactors);
    providerStatus.push(
      {
        provider: "coingecko",
        ok: false,
        fallback: true,
        latencyMs: 0,
        points: syntheticFactors[0]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[0]!),
        error: "Synthetic demo mode enabled",
      },
      {
        provider: "defillama",
        ok: false,
        fallback: true,
        latencyMs: 0,
        points: syntheticFactors[2]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[2]!),
        error: "Synthetic demo mode enabled",
      },
      {
        provider: "alternative",
        ok: false,
        fallback: true,
        latencyMs: 0,
        points: syntheticFactors[3]!.points.length,
        asOf: extractAsOfFromFactor(syntheticFactors[3]!),
        error: "Synthetic demo mode enabled",
      }
    );
  }

  const rollingWindow = Math.min(Math.max(8, Math.floor(points / 3)), 24);
  const minPeriods = Math.min(5, rollingWindow);

  const featureTable = engineerFeatureTable(
    {
      factors,
    },
    {
      rollingWindow,
      minPeriods,
      timelineMode: "union",
    }
  );

  const score = scoreSentimentFromFeatureTable(featureTable);
  const history = scoreSentimentHistoryFromFeatureTable(featureTable);
  const asOf = score.asOf;
  const freshnessSec = Math.max(Math.floor((Date.now() - Date.parse(asOf)) / 1_000), 0);

  const latestMarketPoint = marketPoints.at(-1) ?? null;
  const latestFngPoint = fngPoints.at(-1) ?? null;

  return {
    asOf,
    freshnessSec,
    score,
    history,
    providerStatus,
    featureFactorIds: featureTable.factorIds,
    market: {
      asset,
      latestPrice: latestMarketPoint?.price ?? null,
      latestVolume: latestMarketPoint?.volume ?? null,
      priceChangePct24h: estimatePriceChangePct24h(marketPoints),
    },
    anchors: {
      fearGreedValue: latestFngPoint?.value ?? null,
      fearGreedClassification: latestFngPoint?.classification ?? null,
    },
  };
}
