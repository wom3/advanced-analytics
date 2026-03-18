import assert from "node:assert/strict";
import test from "node:test";

import { engineerFeatureTable } from "@/src/server/services/feature-engineering/service";

test("aligns provider series on a shared union timeline and preserves source metadata", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "llama_tvl",
          source: "defillama",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 100 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 300 },
          ],
        },
        {
          factorId: "cg_volume",
          source: "coingecko",
          points: [
            { timestamp: "2026-01-01T01:00:00.000Z", value: 10 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 20 },
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

  assert.equal(result.rows.length, 3);
  assert.deepEqual(
    result.rows.map((row) => row.timestamp),
    ["2026-01-01T00:00:00.000Z", "2026-01-01T01:00:00.000Z", "2026-01-01T02:00:00.000Z"]
  );
  assert.equal(result.rows[0]!.factors["llama_tvl"]!.source, "defillama");
  assert.equal(result.rows[0]!.factors["cg_volume"]!.source, "coingecko");
});

test("fills missing values using linear interpolation and edge carry", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "llama_tvl",
          source: "defillama",
          points: [
            { timestamp: "2026-01-01T01:00:00.000Z", value: 100 },
            { timestamp: "2026-01-01T03:00:00.000Z", value: 300 },
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

  assert.deepEqual(
    result.rows.map((row) => row.timestamp),
    ["2026-01-01T01:00:00.000Z", "2026-01-01T03:00:00.000Z"]
  );

  const direct = result.rows[0]!.factors["llama_tvl"];
  const trailing = result.rows[1]!.factors["llama_tvl"];
  assert.ok(direct !== undefined);
  assert.ok(trailing !== undefined);
  assert.equal(direct.value, 100);
  assert.equal(direct.imputed, false);
  assert.equal(trailing.value, 300);
  assert.equal(trailing.imputed, false);

  const withGap = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "llama_tvl",
          source: "defillama",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 100 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 300 },
          ],
        },
        {
          factorId: "cg_anchor",
          source: "coingecko",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 5 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 5 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 5 },
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

  assert.deepEqual(
    withGap.rows.map((row) => row.timestamp),
    ["2026-01-01T00:00:00.000Z", "2026-01-01T01:00:00.000Z", "2026-01-01T02:00:00.000Z"]
  );
  assert.equal(withGap.rows[1]!.factors["llama_tvl"]!.value, 200);
  assert.equal(withGap.rows[1]!.factors["llama_tvl"]!.imputed, true);
});

test("computes rolling z-score using requested window and minPeriods", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "series_a",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 1 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 2 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 3 },
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

  assert.equal(result.rows[0]!.factors["series_a"]!.zScore, null);
  assert.equal(result.rows[1]!.factors["series_a"]!.zScore, 1);

  const lastZ = result.rows[2]!.factors["series_a"]!.zScore;
  assert.notEqual(lastZ, null);
  assert.ok(lastZ !== null);
  assert.ok(Math.abs(lastZ - 1.224744871391589) < 1e-12);
});

test("emits per-timestamp factor contribution table from normalized factor strength", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "factor_pos",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 1 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 2 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 3 },
          ],
        },
        {
          factorId: "factor_neg",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 3 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 2 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 1 },
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

  const lastRow = result.rows[2];
  const pos = lastRow!.factors["factor_pos"]!.contribution;
  const neg = lastRow!.factors["factor_neg"]!.contribution;

  assert.notEqual(pos, null);
  assert.notEqual(neg, null);
  assert.ok(pos !== null && neg !== null);
  assert.ok(Math.abs(pos - 0.5) < 1e-8);
  assert.ok(Math.abs(neg + 0.5) < 1e-8);
});

test("clamps minPeriods to rollingWindow when configured larger", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "series_a",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 1 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 2 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 3 },
          ],
        },
      ],
    },
    {
      rollingWindow: 2,
      minPeriods: 10,
      timelineMode: "union",
    }
  );

  assert.equal(result.minPeriods, 2);
  assert.equal(result.rows[0]!.factors["series_a"]!.zScore, null);
  assert.equal(result.rows[1]!.factors["series_a"]!.zScore, 1);
});

test("preserves millisecond timestamp precision during alignment", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "ms_factor",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.100Z", value: 1 },
            { timestamp: "2026-01-01T00:00:00.900Z", value: 2 },
          ],
        },
      ],
    },
    {
      rollingWindow: 2,
      minPeriods: 1,
      timelineMode: "union",
    }
  );

  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((row) => row.timestamp),
    ["2026-01-01T00:00:00.100Z", "2026-01-01T00:00:00.900Z"]
  );
});

test("rejects duplicate factor IDs to avoid map collisions", () => {
  assert.throws(
    () =>
      engineerFeatureTable(
        {
          factors: [
            {
              factorId: "dup_factor",
              source: "a",
              points: [{ timestamp: "2026-01-01T00:00:00.000Z", value: 1 }],
            },
            {
              factorId: "dup_factor",
              source: "b",
              points: [{ timestamp: "2026-01-01T00:00:00.000Z", value: 2 }],
            },
          ],
        },
        {
          rollingWindow: 2,
          minPeriods: 1,
          timelineMode: "union",
        }
      ),
    /Duplicate factorId/
  );
});

test("handles sparse windows correctly with optimized rolling z-score", () => {
  const result = engineerFeatureTable(
    {
      factors: [
        {
          factorId: "sparse",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 1 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 5 },
            { timestamp: "2026-01-01T03:00:00.000Z", value: 9 },
          ],
        },
        {
          factorId: "anchor",
          source: "internal",
          points: [
            { timestamp: "2026-01-01T00:00:00.000Z", value: 0 },
            { timestamp: "2026-01-01T01:00:00.000Z", value: 0 },
            { timestamp: "2026-01-01T02:00:00.000Z", value: 0 },
            { timestamp: "2026-01-01T03:00:00.000Z", value: 0 },
          ],
        },
      ],
    },
    {
      rollingWindow: 2,
      minPeriods: 2,
      timelineMode: "union",
    }
  );

  const z0 = result.rows[0]!.factors["sparse"]!.zScore;
  const z1 = result.rows[1]!.factors["sparse"]!.zScore;
  const z2 = result.rows[2]!.factors["sparse"]!.zScore;
  const z3 = result.rows[3]!.factors["sparse"]!.zScore;

  assert.equal(z0, null);
  assert.equal(z1, 1);
  assert.equal(z2, 1);
  assert.equal(z3, 1);
});
