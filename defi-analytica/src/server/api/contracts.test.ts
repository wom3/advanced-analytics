import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { GET as getApiRoot } from "@/app/api/v1/route";
import { GET as getCoinGeckoMarket } from "@/app/api/v1/coingecko/market/[asset]/route";
import { GET as getDashboardOverview } from "@/app/api/v1/dashboard/overview/route";
import { GET as getLlamaCatalog } from "@/app/api/v1/llama/catalog/route";
import { GET as getSentimentHistory } from "@/app/api/v1/sentiment/history/route";
import { GET as getSentimentScore } from "@/app/api/v1/sentiment/score/route";
import { createApiRequest } from "@/src/test/support/next";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  provider: z.string().min(1),
});

function apiSuccessSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    source: z.string().min(1),
    asOf: z.string().datetime(),
    freshnessSec: z.number().nonnegative(),
    data,
    meta: z.record(z.string(), z.unknown()),
  });
}

const sentimentLabelSchema = z.enum(["bullish", "neutral", "bearish"]);

const sentimentScoreSchema = z.object({
  asOf: z.string().datetime(),
  score: z.number(),
  label: sentimentLabelSchema,
  confidence: z.number().min(0).max(1),
  weightsVersion: z.number().int().positive(),
  contributors: z.object({
    positive: z.array(
      z.object({
        factorId: z.string().min(1),
        source: z.string().min(1),
        weight: z.number(),
        zScore: z.number(),
        weightedContribution: z.number(),
      })
    ),
    negative: z.array(
      z.object({
        factorId: z.string().min(1),
        source: z.string().min(1),
        weight: z.number(),
        zScore: z.number(),
        weightedContribution: z.number(),
      })
    ),
  }),
});

const sentimentHistoryPointSchema = z.object({
  timestamp: z.string().datetime(),
  score: z.number(),
  label: sentimentLabelSchema,
  confidence: z.number().min(0).max(1),
});

const providerStatusSchema = z.object({
  provider: z.enum(["coingecko", "defillama", "alternative"]),
  ok: z.boolean(),
  fallback: z.boolean(),
  latencyMs: z.number().nonnegative(),
  points: z.number().int().nonnegative(),
  asOf: z.string().datetime().nullable(),
  error: z.string().min(1).optional(),
});

const dashboardOverviewSchema = z.object({
  asOf: z.string().datetime(),
  freshnessSec: z.number().nonnegative(),
  score: sentimentScoreSchema,
  history: z.array(sentimentHistoryPointSchema),
  providerStatus: z.array(providerStatusSchema).length(3),
  featureFactorIds: z.array(z.string().min(1)).min(1),
  market: z.object({
    asset: z.string().min(1),
    latestPrice: z.number().nullable(),
    latestVolume: z.number().nullable(),
    priceChangePct24h: z.number().nullable(),
  }),
  anchors: z.object({
    fearGreedValue: z.number().nullable(),
    fearGreedClassification: z.string().nullable(),
  }),
});

const llamaCatalogSchema = z.object({
  activeChain: z.string().min(1),
  chains: z.array(z.string().min(1)).min(1),
  protocols: z.array(
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      category: z.string().nullable(),
      chains: z.array(z.string().min(1)).min(1),
    })
  ),
});

test("api root response matches the shared success envelope", async () => {
  const response = await getApiRoot(createApiRequest("/api/v1"));

  assert.equal(response.status, 200);
  const body = await response.json();

  const parsed = apiSuccessSchema(
    z.object({
      service: z.literal("advanced-analytics-api"),
      version: z.literal("v1"),
      status: z.literal("ok"),
      endpoints: z.array(z.string().min(1)).min(1),
    })
  ).parse(body);

  assert.equal(parsed.meta.route, "/api/v1");
});

test("sentiment score response matches the documented schema", async () => {
  const response = await getSentimentScore(
    createApiRequest("/api/v1/sentiment/score?mode=demo&interval=1h&points=72")
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  const parsed = apiSuccessSchema(sentimentScoreSchema).parse(body);

  assert.equal(parsed.meta.route, "/api/v1/sentiment/score");
});

test("sentiment history response matches the documented schema", async () => {
  const response = await getSentimentHistory(
    createApiRequest("/api/v1/sentiment/history?mode=demo&interval=1h&points=168")
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  const parsed = apiSuccessSchema(z.array(sentimentHistoryPointSchema).min(24)).parse(body);

  assert.equal(parsed.meta.route, "/api/v1/sentiment/history");
});

test("dashboard overview response matches the documented schema", async () => {
  const response = await getDashboardOverview(
    createApiRequest("/api/v1/dashboard/overview?mode=demo&interval=1h&points=48")
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  const parsed = apiSuccessSchema(dashboardOverviewSchema).parse(body);

  assert.equal(parsed.data.history.length, 48);
  assert.equal(parsed.meta.route, "/api/v1/dashboard/overview");
});

test("llama catalog response matches the documented schema", async () => {
  const response = await withMockedFetch(
    async () =>
      createJsonResponse({
        chain: "Ethereum",
        allChains: ["Ethereum", "Base", "Arbitrum"],
        protocols: [
          {
            name: "Curve DEX",
            slug: "curve-dex",
            category: "Dexs",
            chains: ["Ethereum", "Base"],
          },
        ],
      }),
    async () => getLlamaCatalog(createApiRequest("/api/v1/llama/catalog?chain=Ethereum"))
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  const parsed = apiSuccessSchema(llamaCatalogSchema).parse(body);

  assert.equal(parsed.meta.route, "/api/v1/llama/catalog");
});

test("provider routes emit the shared error envelope on invalid input", async () => {
  const response = await getCoinGeckoMarket(
    createApiRequest("/api/v1/coingecko/market/bitcoin?since=not-a-date"),
    {
      params: Promise.resolve({ asset: "bitcoin" }),
    }
  );

  assert.equal(response.status, 400);
  const body = await response.json();

  const parsed = apiErrorSchema.parse(body);

  assert.equal(parsed.code, "COINGECKO_MARKET_FAILED");
  assert.equal(parsed.provider, "coingecko");
});

test("dashboard routes return documented 400 envelopes for invalid shared query parameters", async () => {
  const scoreResponse = await getSentimentScore(
    createApiRequest("/api/v1/sentiment/score?mode=demo&points=12")
  );

  assert.equal(scoreResponse.status, 400);
  assert.ok(scoreResponse.headers.get("x-ratelimit-remaining"));
  assert.ok(scoreResponse.headers.get("x-ratelimit-reset"));

  const scoreBody = await scoreResponse.json();
  const parsedScore = apiErrorSchema.parse(scoreBody);

  assert.equal(parsedScore.code, "SENTIMENT_SCORE_FAILED");
  assert.equal(parsedScore.retryable, false);
  assert.equal(parsedScore.provider, "internal");
  assert.match(parsedScore.message, /points must be an integer between 24 and 720/i);

  const overviewResponse = await getDashboardOverview(
    createApiRequest("/api/v1/dashboard/overview?interval=hourly")
  );

  assert.equal(overviewResponse.status, 400);
  assert.ok(overviewResponse.headers.get("x-ratelimit-remaining"));
  assert.ok(overviewResponse.headers.get("x-ratelimit-reset"));

  const overviewBody = await overviewResponse.json();
  const parsedOverview = apiErrorSchema.parse(overviewBody);

  assert.equal(parsedOverview.code, "DASHBOARD_OVERVIEW_FAILED");
  assert.equal(parsedOverview.retryable, false);
  assert.equal(parsedOverview.provider, "internal");
  assert.match(parsedOverview.message, /interval must match pattern/i);
});
