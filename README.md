# Advanced Analytics

API-first crypto analytics platform that combines:

- Dune data for onchain protocol and wallet behavior
- Free and low-cost market and sentiment sources
- A modern dashboard stack built with Next.js, Chart.js, and Three.js

## Current Status

- Active implementation lives in `defi-analytica/` (Next.js App Router + TypeScript strict mode).
- Implemented provider routes currently cover Dune, DefiLlama, CoinGecko, and Alternative.me, plus an optional exchange microstructure route behind a feature flag.
- Feature 09 is implemented in `defi-analytica/src/server/services/feature-engineering/service.ts` with time alignment, imputation, rolling z-score normalization, and per-timestamp factor contribution output.
- Feature 10 is implemented in `defi-analytica/src/server/services/sentiment-scoring/service.ts` with weighted composite scoring, bullish/neutral/bearish labeling, confidence scoring, and validated configurable weights from `defi-analytica/src/server/services/sentiment-scoring/weights.json`.
- Feature 11 is implemented with `/api/v1/dashboard/overview`, `/api/v1/sentiment/score`, and `/api/v1/sentiment/history`, backed by `defi-analytica/src/server/services/dashboard/service.ts` with provider-status metadata and freshness handling.
- Frontend entrypoints now include a product landing page at `/` alongside the dashboard and sentiment views.
- Feature 17 is implemented with adapter unit tests, API contract tests, dashboard overview route integration tests, and Playwright smoke tests for the primary dashboard pages.
- Product requirements are documented in `requirements.md`.
- Feature-by-feature implementation plan is tracked in `TODO.md`.

## Data Strategy (Free-First)

Primary sources:

- Dune
- DefiLlama
- CoinGecko
- Alternative.me Fear and Greed
- Optional exchange market-data APIs

The platform is designed so premium providers can be added later behind the same adapter contracts.

## Architecture

High-level layers:

- Provider adapters
- Domain services (query, sentiment, dashboard)
- Internal API routes (`/api/v1/*`)
- Frontend dashboard pages

Key rule:

- Never call upstream providers directly from the browser.

## Repository Layout

```text
.
├── README.md
├── requirements.md
├── TODO.md
└── defi-analytica/
	├── app/
	├── src/
	├── proxy.ts
	├── package.json
	└── README.md
```

## Quick Start (Next.js API App)

From the repository root:

```bash
cd defi-analytica
npm i
cp .env.example .env.local
npm run infra:up
npm run dev
```

Local infrastructure (PostgreSQL + Redis) is defined in `defi-analytica/docker-compose.yml`.

Prisma ORM is configured in `defi-analytica/prisma/` and uses `DATABASE_URL` from environment variables.

Create `defi-analytica/.env.local`:

```env
NEXT_PUBLIC_APP_NAME=defi-analytica
DUNE_API_KEY=your_dune_api_key
```

## Endpoint Smoke Tests (Next.js API)

If you are working on the app API in `defi-analytica/`, run:

```bash
cd defi-analytica
npm run dev
```

In a second terminal, quick-check endpoints:

```bash
curl -s "http://localhost:3000/api/v1" | jq
curl -s "http://localhost:3000/api/v1/llama/metrics/tvl?chain=Ethereum&interval=1d" | jq
curl -s "http://localhost:3000/api/v1/coingecko/market/bitcoin?interval=1d" | jq
curl -s "http://localhost:3000/api/v1/fng/latest" | jq
curl -s "http://localhost:3000/api/v1/fng/history?limit=30" | jq
curl -s "http://localhost:3000/api/v1/sentiment/score?mode=demo&interval=1h&points=72" | jq
curl -s "http://localhost:3000/api/v1/sentiment/history?mode=demo&interval=1h&points=72" | jq
curl -s "http://localhost:3000/api/v1/dashboard/overview?mode=demo&interval=1h&points=72" | jq
```

Optional exchange microstructure check (requires `ENABLE_EXCHANGE_SIGNALS=true`):

```bash
curl -s "http://localhost:3000/api/v1/market/microstructure/BTCUSDT?interval=1h&limit=200" | jq
```

Dune flow check (requires `DUNE_API_KEY` in `defi-analytica/.env.local`):

```bash
QUERY_ID=1215383
EXECUTION_ID=$(curl -s -X POST "http://localhost:3000/api/v1/dune/queries/$QUERY_ID/execute" -H "content-type: application/json" -d '{}' | jq -r '.data.executionId')
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/status" | jq
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/results?limit=100" | jq
```

## Testing

From `defi-analytica/`:

```bash
npm test
```

For browser smoke tests, install Chromium once:

```bash
npx playwright install --with-deps chromium
```

Then run:

```bash
npm run test:e2e
```

The Playwright suite exercises `/dashboard`, `/dashboard/sentiment`, and `/dashboard/flows` using demo-mode query params to avoid flaky dependence on live upstream providers.

## Roadmap

Implementation is organized into feature blocks in `TODO.md`, including:

- API foundation and provider adapters
- sentiment scoring and aggregation APIs
- dashboard pages and visualization components
- schedulers, testing, reliability, and security
- optional and out-of-scope backlog items

## Documentation

- Product and architecture requirements: `requirements.md`
- Feature-by-feature plan: `TODO.md`
- App and endpoint documentation: `defi-analytica/README.md`
