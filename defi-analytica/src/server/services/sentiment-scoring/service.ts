import { z } from "zod";

import type {
  FactorCell,
  FeatureEngineeringResult,
  FeatureEngineeringRow,
} from "@/src/server/services/feature-engineering/service";

import rawWeightsConfig from "./weights.json";

const sentimentWeightsSchema = z
  .object({
    version: z.number().int().positive(),
    defaultWeight: z.number().positive().finite(),
    factors: z.record(z.string(), z.number().positive().finite()),
    labelThresholds: z.object({
      bullish: z.number().finite(),
      bearish: z.number().finite(),
    }),
    confidence: z.object({
      scoreScale: z.number().positive().finite(),
      weightCoverageWeight: z.number().nonnegative().finite(),
      scoreStrengthWeight: z.number().nonnegative().finite(),
    }),
  })
  .superRefine((config, context) => {
    if (config.labelThresholds.bearish >= config.labelThresholds.bullish) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "labelThresholds.bearish must be less than labelThresholds.bullish",
        path: ["labelThresholds"],
      });
    }

    const combinedWeight =
      config.confidence.weightCoverageWeight + config.confidence.scoreStrengthWeight;
    if (Math.abs(combinedWeight - 1) > 1e-9) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidence.weightCoverageWeight + confidence.scoreStrengthWeight must equal 1",
        path: ["confidence"],
      });
    }
  });

export type SentimentWeightsConfig = z.infer<typeof sentimentWeightsSchema>;

export type SentimentLabel = "bullish" | "neutral" | "bearish";

export type SentimentContributor = {
  factorId: string;
  source: string;
  weight: number;
  zScore: number;
  weightedContribution: number;
};

export type SentimentScoreResult = {
  asOf: string;
  score: number;
  label: SentimentLabel;
  confidence: number;
  weightsVersion: number;
  contributors: {
    positive: SentimentContributor[];
    negative: SentimentContributor[];
  };
};

const sentimentWeightsConfig = sentimentWeightsSchema.parse(rawWeightsConfig);

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toLabel(
  score: number,
  thresholds: SentimentWeightsConfig["labelThresholds"]
): SentimentLabel {
  if (score > thresholds.bullish) {
    return "bullish";
  }
  if (score < thresholds.bearish) {
    return "bearish";
  }
  return "neutral";
}

function resolveWeight(factorId: string, config: SentimentWeightsConfig): number {
  const configured = config.factors[factorId];
  if (configured === undefined) {
    return config.defaultWeight;
  }
  return configured;
}

function computeWeightedContributors(
  factors: Record<string, FactorCell>,
  config: SentimentWeightsConfig
): {
  weightedSum: number;
  usedAbsWeight: number;
  totalAbsWeight: number;
  factors: SentimentContributor[];
} {
  let weightedSum = 0;
  let usedAbsWeight = 0;
  let totalAbsWeight = 0;

  const contributors: SentimentContributor[] = [];

  for (const [factorId, cell] of Object.entries(factors)) {
    const weight = resolveWeight(factorId, config);
    totalAbsWeight += Math.abs(weight);

    const zScore = cell.zScore;
    if (zScore === null || !Number.isFinite(zScore)) {
      continue;
    }

    const weightedValue = weight * zScore;
    weightedSum += weightedValue;
    usedAbsWeight += Math.abs(weight);

    contributors.push({
      factorId,
      source: cell.source,
      weight,
      zScore,
      weightedContribution: weightedValue,
    });
  }

  return {
    weightedSum,
    usedAbsWeight,
    totalAbsWeight,
    factors: contributors,
  };
}

function normalizeContributorShares(
  contributors: SentimentContributor[],
  usedAbsWeight: number
): SentimentContributor[] {
  if (usedAbsWeight === 0) {
    return contributors.map((contributor) => ({
      ...contributor,
      weightedContribution: 0,
    }));
  }

  return contributors.map((contributor) => ({
    ...contributor,
    weightedContribution: Number((contributor.weightedContribution / usedAbsWeight).toFixed(8)),
  }));
}

function selectLatestRow(table: FeatureEngineeringResult): FeatureEngineeringRow {
  const latest = table.rows[table.rows.length - 1];
  if (latest === undefined) {
    throw new Error("Cannot score sentiment from an empty feature table.");
  }
  return latest;
}

export function scoreSentimentFromFeatureTable(
  table: FeatureEngineeringResult,
  config: SentimentWeightsConfig = sentimentWeightsConfig
): SentimentScoreResult {
  const latestRow = selectLatestRow(table);
  const weighted = computeWeightedContributors(latestRow.factors, config);

  const score =
    weighted.usedAbsWeight === 0
      ? 0
      : Number((weighted.weightedSum / weighted.usedAbsWeight).toFixed(8));

  const coverage =
    weighted.totalAbsWeight === 0 ? 0 : weighted.usedAbsWeight / weighted.totalAbsWeight;

  const scoreStrength = clamp01(Math.abs(score) / config.confidence.scoreScale);
  const confidence = Number(
    clamp01(
      config.confidence.scoreStrengthWeight * scoreStrength +
        config.confidence.weightCoverageWeight * coverage
    ).toFixed(8)
  );

  const normalizedContributors = normalizeContributorShares(
    weighted.factors,
    weighted.usedAbsWeight
  );

  const positive = normalizedContributors
    .filter((contributor) => contributor.weightedContribution > 0)
    .sort((left, right) => right.weightedContribution - left.weightedContribution)
    .slice(0, 3);

  const negative = normalizedContributors
    .filter((contributor) => contributor.weightedContribution < 0)
    .sort((left, right) => left.weightedContribution - right.weightedContribution)
    .slice(0, 3);

  return {
    asOf: latestRow.timestamp,
    score,
    label: toLabel(score, config.labelThresholds),
    confidence,
    weightsVersion: config.version,
    contributors: {
      positive,
      negative,
    },
  };
}

export function parseSentimentWeightsConfig(input: unknown): SentimentWeightsConfig {
  return sentimentWeightsSchema.parse(input);
}

export function getDefaultSentimentWeightsConfig(): SentimentWeightsConfig {
  return sentimentWeightsConfig;
}
