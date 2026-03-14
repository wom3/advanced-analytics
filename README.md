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


