import assert from "node:assert/strict";
import test from "node:test";

import {
  AnalyticsQueryParseError,
  parseAnalyticsQuery,
} from "@/src/server/api/analytics-query";

test("parseAnalyticsQuery supplies documented defaults", () => {
  const parsed = parseAnalyticsQuery(new URLSearchParams());

  assert.deepEqual(parsed, {
    mode: "live",
    interval: "1h",
    points: 72,
    asset: "bitcoin",
    chain: "Ethereum",
  });
});

test("parseAnalyticsQuery accepts explicit valid overrides", () => {
  const parsed = parseAnalyticsQuery(
    new URLSearchParams({
      mode: "demo",
      interval: "6h",
      points: "168",
      asset: "ethereum",
      chain: "Base",
    }),
    { defaultPoints: 48 }
  );

  assert.deepEqual(parsed, {
    mode: "demo",
    interval: "6h",
    points: 168,
    asset: "ethereum",
    chain: "Base",
  });
});

test("parseAnalyticsQuery rejects invalid shared query parameters", async (t) => {
  await t.test("mode", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ mode: "paper" })),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticsQueryParseError);
        assert.match(error.message, /mode must be one of/i);
        return true;
      }
    );
  });

  await t.test("interval", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ interval: "hourly" })),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticsQueryParseError);
        assert.match(error.message, /interval must match pattern/i);
        return true;
      }
    );
  });

  await t.test("points", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ points: "12" })),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticsQueryParseError);
        assert.match(error.message, /points must be an integer between 24 and 720/i);
        return true;
      }
    );
  });

  await t.test("asset", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ asset: "Bitcoin Cash" })),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticsQueryParseError);
        assert.match(error.message, /asset must contain only lowercase letters/i);
        return true;
      }
    );
  });

  await t.test("chain", () => {
    assert.throws(
      () => parseAnalyticsQuery(new URLSearchParams({ chain: "   " })),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticsQueryParseError);
        assert.match(error.message, /chain must be a non-empty chain name/i);
        return true;
      }
    );
  });
});