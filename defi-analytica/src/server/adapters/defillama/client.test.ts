import assert from "node:assert/strict";
import test from "node:test";

import {
  LlamaApiError,
  getLlamaDexFilterCatalog,
  getLlamaMetricSeries,
} from "@/src/server/adapters/defillama/client";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

test("aggregates protocol chain TVL across matching DefiLlama chain keys", async () => {
  const calls: string[] = [];

  const result = await withMockedFetch(
    async (input) => {
      calls.push(String(input));

      return createJsonResponse({
        chainTvls: {
          Ethereum: {
            tvl: [{ date: 1710000000, totalLiquidityUSD: 100 }],
          },
          "Ethereum-staking": {
            tvl: [{ date: 1710000000, totalLiquidityUSD: 50 }],
          },
          Solana: {
            tvl: [{ date: 1710000000, totalLiquidityUSD: 25 }],
          },
        },
      });
    },
    async () =>
      getLlamaMetricSeries("tvl", {
        protocol: "aave",
        chain: "Ethereum",
        interval: "1d",
      })
  );

  assert.match(calls[0] ?? "", /\/protocol\/aave$/);
  assert.equal(result.metric, "tvl");
  assert.equal(result.chain, "Ethereum");
  assert.deepEqual(result.points, [
    {
      timestamp: "2024-03-09T16:00:00.000Z",
      value: 150,
    },
  ]);
});

test("rejects invalid DefiLlama intervals before fetching", async () => {
  await assert.rejects(
    () =>
      getLlamaMetricSeries("volume", {
        chain: "Ethereum",
        interval: "daily",
      }),
    (error: unknown) => {
      assert.ok(error instanceof LlamaApiError);
      assert.equal(error.status, 400);
      assert.match(error.message, /interval must match pattern/);
      return true;
    }
  );
});

test("builds a DEX filter catalog from overview metadata", async () => {
  const catalog = await withMockedFetch(
    async () =>
      createJsonResponse({
        chain: "Ethereum",
        allChains: ["Base", "Ethereum", "Arbitrum"],
        protocols: [
          {
            name: "SushiSwap",
            slug: "sushiswap",
            category: "Dexs",
            chains: ["Ethereum", "Arbitrum"],
          },
          {
            name: "Curve DEX",
            slug: "curve-dex",
            category: "Dexs",
            chains: ["Ethereum", "Base"],
          },
          {
            name: "Jupiter",
            slug: "jupiter",
            category: "Dexs",
            chains: ["Solana"],
          },
        ],
      }),
    async () => getLlamaDexFilterCatalog("Ethereum")
  );

  assert.equal(catalog.activeChain, "Ethereum");
  assert.deepEqual(catalog.chains, ["Arbitrum", "Base", "Ethereum"]);
  assert.deepEqual(catalog.protocols, [
    {
      name: "Curve DEX",
      slug: "curve-dex",
      category: "Dexs",
      chains: ["Base", "Ethereum"],
    },
    {
      name: "SushiSwap",
      slug: "sushiswap",
      category: "Dexs",
      chains: ["Arbitrum", "Ethereum"],
    },
  ]);
});
