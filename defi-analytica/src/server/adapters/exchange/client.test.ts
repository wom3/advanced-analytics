import assert from "node:assert/strict";
import test from "node:test";

import {
  ExchangeApiError,
  getExchangeMicrostructureSeries,
} from "@/src/server/adapters/exchange/client";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

function buildKlineRow(index: number): unknown[] {
  const baseOpen = 100 + index;
  const baseClose = baseOpen + 1;

  return [
    1710000000000 + index * 3600000,
    String(baseOpen),
    String(baseClose + 1),
    String(baseOpen - 1),
    String(baseClose),
    String(25 + index),
    0,
    String(500 + index * 10),
    String(100 + index),
  ];
}

test("computes exchange momentum and realized volatility", async () => {
  const series = await withMockedFetch(
    async () => createJsonResponse(Array.from({ length: 25 }, (_, index) => buildKlineRow(index))),
    async () =>
      getExchangeMicrostructureSeries("btcusdt", {
        interval: "1h",
        sinceSec: 1710000000,
        untilSec: 1710086400,
        limit: 25,
      })
  );

  assert.equal(series.venue, "binance");
  assert.equal(series.symbol, "BTCUSDT");
  assert.equal(series.points.length, 25);
  assert.equal(series.points[0]?.momentum, null);
  assert.notEqual(series.points[10]?.momentum, null);
  assert.notEqual(series.points[20]?.realizedVolatility, null);
});

test("rejects invalid exchange symbols before fetching", async () => {
  await assert.rejects(
    () => getExchangeMicrostructureSeries("btc-usdt"),
    (error: unknown) => {
      assert.ok(error instanceof ExchangeApiError);
      assert.equal(error.status, 400);
      assert.match(error.message, /contain only A-Z and 0-9/);
      return true;
    }
  );
});
