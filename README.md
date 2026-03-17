# Advanced Analytics

API-first crypto analytics platform that combines:

- Dune data for onchain protocol and wallet behavior
- Free and low-cost market and sentiment sources
- A modern dashboard stack built with Next.js, Chart.js, and Three.js

## Current Status

- The workspace currently includes a functional Dune MCP server under `tools/dune-analytics-mcp`.
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
└── tools/
	└── dune-analytics-mcp/
		├── main.py
		├── run_dune_query.py
		├── pyproject.toml
		└── README.md
```

## Quick Start (Dune MCP Server)

From the repository root:

```bash
cd tools/dune-analytics-mcp
python3.13 -m venv .venv
.venv/bin/python -m pip install -U pip mcp[cli] httpx pandas python-dotenv socksio
```

Create `tools/dune-analytics-mcp/.env`:

```env
DUNE_API_KEY=your_dune_api_key
```

Run server:

```bash
.venv/bin/python main.py
```

Run a query smoke test:

```bash
.venv/bin/python run_dune_query.py 1215383
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
```

Dune flow check (requires `DUNE_API_KEY` in `defi-analytica/.env.local`):

```bash
QUERY_ID=1215383
EXECUTION_ID=$(curl -s -X POST "http://localhost:3000/api/v1/dune/queries/$QUERY_ID/execute" -H "content-type: application/json" -d '{}' | jq -r '.data.executionId')
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/status" | jq
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/results?limit=100" | jq
```

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
- MCP server details: `tools/dune-analytics-mcp/README.md`
