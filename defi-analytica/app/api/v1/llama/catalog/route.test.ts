import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/v1/llama/catalog/route";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";
import { createApiRequest } from "@/src/test/support/next";

test("llama catalog route returns normalized chain and protocol data", async () => {
  const response = await withMockedFetch(
    async () =>
      createJsonResponse({
        chain: "Ethereum",
        allChains: ["Ethereum", "Base", "Arbitrum"],
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
        ],
      }),
    async () =>
      GET(
        createApiRequest("/api/v1/llama/catalog?chain=Ethereum", {
          requestId: "req-llama-catalog",
        })
      )
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "req-llama-catalog");

  const body = await response.json();
  assert.equal(body.meta.route, "/api/v1/llama/catalog");
  assert.equal(body.data.activeChain, "Ethereum");
  assert.deepEqual(body.data.chains, ["Arbitrum", "Base", "Ethereum"]);
  assert.equal(body.data.protocols.length, 2);
});