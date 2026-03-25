import assert from "node:assert/strict";
import test from "node:test";

import {
  DashboardQueryParseError,
  parseDashboardQuery,
} from "@/src/server/api/dashboard-query";

test("parseDashboardQuery supplies documented defaults", () => {
  const parsed = parseDashboardQuery(new URLSearchParams());

  assert.deepEqual(parsed, {
    mode: "live",
    interval: "1h",
    points: 72,
    asset: "bitcoin",
    chain: "Ethereum",
  });
});

test("parseDashboardQuery accepts explicit valid overrides", () => {
  const parsed = parseDashboardQuery(
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

test("parseDashboardQuery rejects invalid shared query parameters", async (t) => {
  await t.test("mode", () => {
    assert.throws(
      () => parseDashboardQuery(new URLSearchParams({ mode: "paper" })),
      (error: unknown) => {
        assert.ok(error instanceof DashboardQueryParseError);
        assert.match(error.message, /mode must be one of/i);
        return true;
      }
    );
  });

  await t.test("interval", () => {
    assert.throws(
      () => parseDashboardQuery(new URLSearchParams({ interval: "hourly" })),
      (error: unknown) => {
        assert.ok(error instanceof DashboardQueryParseError);
        assert.match(error.message, /interval must match pattern/i);
        return true;
      }
    );
  });

  await t.test("points", () => {
    assert.throws(
      () => parseDashboardQuery(new URLSearchParams({ points: "12" })),
      (error: unknown) => {
        assert.ok(error instanceof DashboardQueryParseError);
        assert.match(error.message, /points must be an integer between 24 and 720/i);
        return true;
      }
    );
  });

  await t.test("asset", () => {
    assert.throws(
      () => parseDashboardQuery(new URLSearchParams({ asset: "Bitcoin Cash" })),
      (error: unknown) => {
        assert.ok(error instanceof DashboardQueryParseError);
        assert.match(error.message, /asset must contain only lowercase letters/i);
        return true;
      }
    );
  });

  await t.test("chain", () => {
    assert.throws(
      () => parseDashboardQuery(new URLSearchParams({ chain: "   " })),
      (error: unknown) => {
        assert.ok(error instanceof DashboardQueryParseError);
        assert.match(error.message, /chain must be a non-empty chain name/i);
        return true;
      }
    );
  });
});