import assert from "node:assert/strict";
import test from "node:test";

import { engineerFeatureTable } from "@/src/server/services/feature-engineering/service";
import {
  getDefaultSentimentWeightsConfig,
  parseSentimentWeightsConfig,
  scoreSentimentFromFeatureTable,
} from "@/src/server/services/sentiment-scoring/service";

test("computes weighted factor score and bullish label", () => {
  const table = {
    asOf: "2026-01-02T00:00:00.000Z",
    rows: [
      {
        timestamp: "2026-01-02T00:00:00.000Z",
        factors: {
          factor_a: {
            source: "internal",
            raw: 10,
            value: 10,
            zScore: 2,
            contribution: 0.8,
            imputed: false,
          },
          factor_b: {
            source: "internal",
            raw: 5,
            value: 5,
            zScore: 0.5,
            contribution: 0.2,
            imputed: false,
          },
        },
      },
    ],
    factorIds: ["factor_a", "factor_b"],
    timelineMode: "union" as const,
    rollingWindow: 3,
    minPeriods: 2,
  };

  const config = parseSentimentWeightsConfig({
    version: 1,
    defaultWeight: 1,
    factors: {
      factor_a: 2,
      factor_b: 1,
    },
    labelThresholds: {
      bullish: 1,
      bearish: -1,
    },
    confidence: {
      scoreScale: 2,
      weightCoverageWeight: 0.35,
      scoreStrengthWeight: 0.65,
    },
  });

  const result = scoreSentimentFromFeatureTable(table, config);

  assert.equal(result.score, 1.5);
  assert.equal(result.label, "bullish");
  assert.equal(result.asOf, "2026-01-02T00:00:00.000Z");
});

test("returns neutral score with low confidence when no z-scores are available", () => {
  const table = {
    asOf: "2026-01-02T00:00:00.000Z",
    rows: [
      {
        timestamp: "2026-01-02T00:00:00.000Z",
        factors: {
          factor_a: {
            source: "internal",
            raw: 10,
            value: 10,
            zScore: null,
            contribution: null,
            imputed: false,
          },
        },
      },
    ],
    factorIds: ["factor_a"],
    timelineMode: "union" as const,
    rollingWindow: 3,
    minPeriods: 2,
  };

  const result = scoreSentimentFromFeatureTable(table);

  assert.equal(result.score, 0);
  assert.equal(result.label, "neutral");
  assert.equal(result.confidence, 0);
  assert.equal(result.contributors.positive.length, 0);
  assert.equal(result.contributors.negative.length, 0);
});

test("validates confidence weights and label thresholds in config", () => {
  assert.throws(
    () =>
      parseSentimentWeightsConfig({
        version: 1,
        defaultWeight: 1,
        factors: {},
        labelThresholds: {
          bullish: 0,
          bearish: 0,
        },
        confidence: {
          scoreScale: 2,
          weightCoverageWeight: 0.2,
          scoreStrengthWeight: 0.2,
        },
      }),
    /must be less than|must equal 1/
  );
});

test("feature 09 and feature 10 smoke path works end-to-end", () => {
  const featureTable = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "factor_growth",
          source: "defillama",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 100 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 120 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 150 },
            { timestamp: "2026-01-01T03:00:00.000Z", value: 180 },
          ],
        },
        {
          factorId: "factor_decline",
          source: "coingecko",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 180 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 170 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 150 },
            { timestamp: "2026-01-01T03:00:00.000Z", value: 130 },
          ],
        },
      ],
    },
    {
      rollingWindow: 3,
      minPeriods: 2,
      timelineMode: "union",
    }
  );

  const config = parseSentimentWeightsConfig({
    version: 1,
    defaultWeight: 1,
    factors: {
      factor_growth: 1.8,
      factor_decline: 0.8,
    },
    labelThresholds: {
      bullish: 1,
      bearish: -1,
    },
    confidence: {
      scoreScale: 2,
      weightCoverageWeight: 0.35,
      scoreStrengthWeight: 0.65,
    },
  });

  const scored = scoreSentimentFromFeatureTable(featureTable, config);

  assert.equal(featureTable.rows.length, 4);
  assert.equal(scored.asOf, "2026-01-01T03:00:00.000Z");
  assert.ok(Number.isFinite(scored.score));
  assert.ok(scored.score > 0);
  assert.equal(scored.label, "neutral");
  assert.ok(scored.confidence > 0.5);
});

test("exposes validated default weights config", () => {
  const config = getDefaultSentimentWeightsConfig();
  assert.equal(config.version, 1);
  assert.equal(config.labelThresholds.bullish, 1);
  assert.equal(config.labelThresholds.bearish, -1);
});
