import assert from "node:assert/strict";
import test from "node:test";

import {
  CoinGeckoApiError,
  getCoinGeckoMarketSeries,
} from "@/src/server/adapters/coingecko/client";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

test("normalizes CoinGecko market chart ranges", async () => {
  const calls: Array<{ input: string; init: RequestInit | undefined }> = [];

  const series = await withMockedFetch(
    async (input, init) => {
      calls.push({ input: String(input), init });

      return createJsonResponse({
        prices: [
          [1710000000000, 100],
          [1710003600000, 110],
          [1710007200000, 125],
        ],
        market_caps: [
          [1710000000000, 1_000],
          [1710003600000, 1_100],
          [1710007200000, 1_250],
        ],
        total_volumes: [
          [1710000000000, 50],
          [1710003600000, 55],
          [1710007200000, 70],
        ],
      });
    },
    async () =>
      getCoinGeckoMarketSeries("bitcoin", {
        sinceSec: 1710000000,
        untilSec: 1710007200,
        interval: "1h",
      })
  );

  assert.match(calls[0]?.input ?? "", /coins\/bitcoin\/market_chart\/range/);
  assert.match(calls[0]?.input ?? "", /interval=hourly/);
  assert.equal(series.asset, "bitcoin");
  assert.equal(series.vsCurrency, "usd");
  assert.equal(series.interval, "1h");
  assert.deepEqual(series.points, [
    {
      timestamp: "2024-03-09T16:00:00.000Z",
      price: 100,
      marketCap: 1000,
      volume: 50,
    },
    {
      timestamp: "2024-03-09T17:00:00.000Z",
      price: 110,
      marketCap: 1100,
      volume: 55,
    },
    {
      timestamp: "2024-03-09T18:00:00.000Z",
      price: 125,
      marketCap: 1250,
      volume: 70,
    },
  ]);
});

test("rejects invalid CoinGecko intervals before fetching", async () => {
  await assert.rejects(
    () => getCoinGeckoMarketSeries("bitcoin", { interval: "hourly" }),
    (error: unknown) => {
      assert.ok(error instanceof CoinGeckoApiError);
      assert.equal(error.status, 400);
      assert.match(error.message, /interval must match pattern/);
      return true;
    }
  );
});
