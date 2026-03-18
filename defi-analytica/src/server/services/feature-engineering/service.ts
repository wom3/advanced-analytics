export type FeatureValuePoint = {
  timestamp: string;
  value: number;
};

export type FeatureFactorInput = {
  factorId: string;
  source: string;
  points: FeatureValuePoint[];
};

export type FeatureEngineeringInput = {
  factors: FeatureFactorInput[];
};

export type FeatureEngineeringOptions = {
  rollingWindow?: number;
  minPeriods?: number;
  timelineMode?: "union" | "intersection";
};

export type FactorCell = {
  source: string;
  raw: number | null;
  value: number | null;
  zScore: number | null;
  contribution: number | null;
  imputed: boolean;
};

export type FeatureEngineeringRow = {
  timestamp: string;
  factors: Record<string, FactorCell>;
};

export type FeatureEngineeringResult = {
  asOf: string;
  rows: FeatureEngineeringRow[];
  factorIds: string[];
  timelineMode: "union" | "intersection";
  rollingWindow: number;
  minPeriods: number;
};

type IndexedPoint = {
  timestampSec: number;
  value: number;
};

type IndexedFactor = {
  factorId: string;
  source: string;
  points: IndexedPoint[];
};

type ImputationResult = {
  values: Array<number | null>;
  imputedFlags: boolean[];
};

function timestampToSec(value: string): number | null {
  const asDate = Date.parse(value);
  if (!Number.isFinite(asDate)) {
    return null;
  }
  return Math.floor(asDate / 1_000);
}

function toIso(timestampSec: number): string {
  return new Date(timestampSec * 1_000).toISOString();
}

function sanitizePoints(points: FeatureValuePoint[]): IndexedPoint[] {
  const byTimestamp = new Map<number, number>();

  for (const point of points) {
    const timestampSec = timestampToSec(point.timestamp);
    if (timestampSec === null || !Number.isFinite(point.value)) {
      continue;
    }

    byTimestamp.set(timestampSec, point.value);
  }

  return [...byTimestamp.entries()]
    .map(([timestampSec, value]) => ({
      timestampSec,
      value,
    }))
    .sort((left, right) => left.timestampSec - right.timestampSec);
}

function sanitizeFactors(factors: FeatureFactorInput[]): IndexedFactor[] {
  return factors
    .map((factor) => ({
      factorId: factor.factorId.trim(),
      source: factor.source.trim() || "unknown",
      points: sanitizePoints(factor.points),
    }))
    .filter((factor) => factor.factorId.length > 0);
}

function buildTimeline(factors: IndexedFactor[], timelineMode: "union" | "intersection"): number[] {
  if (factors.length === 0) {
    return [];
  }

  if (timelineMode === "union") {
    const tsSet = new Set<number>();
    for (const factor of factors) {
      for (const point of factor.points) {
        tsSet.add(point.timestampSec);
      }
    }
    return [...tsSet].sort((left, right) => left - right);
  }

  const firstFactor = factors[0]!;
  const intersection = new Set(firstFactor.points.map((point) => point.timestampSec));

  for (let index = 1; index < factors.length; index += 1) {
    const factor = factors[index]!;
    const timestamps = new Set(factor.points.map((point) => point.timestampSec));
    for (const existing of intersection) {
      if (!timestamps.has(existing)) {
        intersection.delete(existing);
      }
    }
  }

  return [...intersection].sort((left, right) => left - right);
}

function imputeLinearWithEdgeCarry(values: Array<number | null>): ImputationResult {
  const output = [...values];
  const imputedFlags = values.map(() => false);

  const observed: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== null) {
      observed.push(index);
    }
  }

  if (observed.length === 0) {
    return {
      values: output,
      imputedFlags,
    };
  }

  const firstObserved = observed[0]!;
  const firstValue = output[firstObserved] ?? null;
  if (firstValue !== null) {
    for (let index = 0; index < firstObserved; index += 1) {
      output[index] = firstValue;
      imputedFlags[index] = true;
    }
  }

  for (let pointer = 0; pointer < observed.length - 1; pointer += 1) {
    const startIndex = observed[pointer]!;
    const endIndex = observed[pointer + 1]!;
    const startValue = output[startIndex] ?? null;
    const endValue = output[endIndex] ?? null;

    if (startValue === null || endValue === null) {
      continue;
    }

    const gapSize = endIndex - startIndex;
    if (gapSize <= 1) {
      continue;
    }

    for (let cursor = startIndex + 1; cursor < endIndex; cursor += 1) {
      const ratio = (cursor - startIndex) / gapSize;
      output[cursor] = startValue + (endValue - startValue) * ratio;
      imputedFlags[cursor] = true;
    }
  }

  const lastObserved = observed[observed.length - 1]!;
  const lastValue = output[lastObserved] ?? null;
  if (lastValue !== null) {
    for (let index = lastObserved + 1; index < output.length; index += 1) {
      output[index] = lastValue;
      imputedFlags[index] = true;
    }
  }

  return {
    values: output,
    imputedFlags,
  };
}

function rollingZScores(
  values: Array<number | null>,
  rollingWindow: number,
  minPeriods: number
): Array<number | null> {
  return values.map((value, index) => {
    if (value === null) {
      return null;
    }

    const windowStart = Math.max(0, index - rollingWindow + 1);
    const observed: number[] = [];

    for (let cursor = windowStart; cursor <= index; cursor += 1) {
      const current = values[cursor] ?? null;
      if (current !== null) {
        observed.push(current);
      }
    }

    if (observed.length < minPeriods) {
      return null;
    }

    const mean = observed.reduce((sum, current) => sum + current, 0) / observed.length;
    const variance =
      observed.reduce((sum, current) => {
        const delta = current - mean;
        return sum + delta * delta;
      }, 0) / observed.length;
    const stdDev = Math.sqrt(Math.max(variance, 0));

    if (stdDev === 0) {
      return 0;
    }

    return (value - mean) / stdDev;
  });
}

export function engineerFeatureTable(
  input: FeatureEngineeringInput,
  options?: FeatureEngineeringOptions
): FeatureEngineeringResult {
  const rollingWindow = Math.max(1, Math.floor(options?.rollingWindow ?? 20));
  const minPeriods = Math.max(1, Math.floor(options?.minPeriods ?? Math.min(rollingWindow, 5)));
  const timelineMode = options?.timelineMode ?? "union";

  const factors = sanitizeFactors(input.factors);
  const timeline = buildTimeline(factors, timelineMode);

  const perFactorRaw = new Map<string, Array<number | null>>();
  const perFactorValue = new Map<string, Array<number | null>>();
  const perFactorImputed = new Map<string, boolean[]>();
  const perFactorZ = new Map<string, Array<number | null>>();
  const factorSources = new Map<string, string>();

  for (const factor of factors) {
    factorSources.set(factor.factorId, factor.source);
    const pointByTimestamp = new Map<number, number>(
      factor.points.map((point) => [point.timestampSec, point.value])
    );

    const rawAligned = timeline.map((timestampSec) => {
      const value = pointByTimestamp.get(timestampSec);
      return value === undefined ? null : value;
    });

    const imputed = imputeLinearWithEdgeCarry(rawAligned);
    const zScores = rollingZScores(imputed.values, rollingWindow, minPeriods);

    perFactorRaw.set(factor.factorId, rawAligned);
    perFactorValue.set(factor.factorId, imputed.values);
    perFactorImputed.set(factor.factorId, imputed.imputedFlags);
    perFactorZ.set(factor.factorId, zScores);
  }

  const factorIds = factors.map((factor) => factor.factorId);
  const rows: FeatureEngineeringRow[] = timeline.map((timestampSec, rowIndex) => {
    const denominator = factorIds.reduce((sum, factorId) => {
      const zScore = perFactorZ.get(factorId)?.[rowIndex] ?? null;
      if (zScore === null) {
        return sum;
      }
      return sum + Math.abs(zScore);
    }, 0);

    const rowFactors: Record<string, FactorCell> = {};
    for (const factorId of factorIds) {
      const raw = perFactorRaw.get(factorId)?.[rowIndex] ?? null;
      const value = perFactorValue.get(factorId)?.[rowIndex] ?? null;
      const zScore = perFactorZ.get(factorId)?.[rowIndex] ?? null;
      const imputed = perFactorImputed.get(factorId)?.[rowIndex] ?? false;
      const contribution =
        zScore === null ? null : denominator === 0 ? 0 : Number((zScore / denominator).toFixed(8));

      rowFactors[factorId] = {
        source: factorSources.get(factorId) ?? "unknown",
        raw,
        value,
        zScore,
        contribution,
        imputed,
      };
    }

    return {
      timestamp: toIso(timestampSec),
      factors: rowFactors,
    };
  });

  const asOf = rows.length > 0 ? rows[rows.length - 1]!.timestamp : new Date(0).toISOString();

  return {
    asOf,
    rows,
    factorIds,
    timelineMode,
    rollingWindow,
    minPeriods,
  };
}
