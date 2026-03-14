# Advanced Analytics Dashboard Requirements

## 1. Product Goal

Build an API-first analytics platform that combines:

- Dune query results for onchain protocol activity
- Free and low-cost market regime and sentiment sources
- A modern frontend using Next.js, Chart.js, and Three.js

Primary outcome:

- A sentiment-aware analytics dashboard with production-ready data pipelines and reusable API contracts.

## 2. Tech Stack

### Core

- Next.js 15+ (App Router)
- TypeScript (strict mode)
- React 19+
- Node.js 20 LTS

### Visualization

- Chart.js + react-chartjs-2 for time-series, bars, and mixed charts
- Three.js + react-three-fiber for immersive market-state visualization

### Data Layer and API

- Next.js Route Handlers as internal API layer
- Optional external API service in FastAPI (recommended for scaling)
- Zod for runtime request and response validation
- TanStack Query for frontend data fetching and caching

### Storage and Caching

- PostgreSQL (primary analytics store)
- Redis (hot cache for query responses and aggregates)

### Jobs and Scheduling

- Cron scheduler (local) and GitHub Actions (remote) for periodic refresh

## 3. Scope

### In Scope

- API-first architecture that wraps Dune and free/low-cost alternatives
- Query execution, polling, result normalization, and persistence
- Dashboard views for trend, flow, and sentiment
- Configurable sentiment scoring model
- Basic alerting hooks for sentiment regime changes

### Out of Scope (Phase 1)

- Trade execution and broker integration
- Multi-tenant auth and billing
- Complex MLOps model retraining pipelines

## 4. API-First Architecture

### Guiding Principle

Never call upstream providers directly from the browser.

Use a backend API boundary for:

- secret management
- consistent schemas
- retries, rate-limit handling, and observability

### API Layers

- Layer A: External provider adapters
  - Dune adapter
  - DefiLlama adapter
  - CoinGecko adapter
  - Alternative.me adapter
  - Exchange market-data adapter (optional)
- Layer B: Domain services
  - query service
  - sentiment service
  - dashboard service
- Layer C: Public API routes consumed by frontend

## 5. API Requirements (v1)

Base path:

- /api/v1

### Dune routes

- POST /api/v1/dune/queries/:queryId/execute
  - triggers query execution
  - returns executionId

- GET /api/v1/dune/executions/:executionId/status
  - returns current state and metadata

- GET /api/v1/dune/executions/:executionId/results
  - returns normalized rows, columns, and timestamps

- GET /api/v1/dune/queries/:queryId/latest
  - returns latest result without forcing new execution

### Market and sentiment routes (free-first)

- GET /api/v1/llama/metrics/:metric
  - query params: chain, protocol, interval, since, until
  - returns normalized TVL, volume, fees, and perps time-series points

- GET /api/v1/coingecko/market/:asset
  - query params: interval, since, until
  - returns price, market cap, and volume time series

- GET /api/v1/fng/latest
  - returns latest fear and greed reading with timestamp and label

- GET /api/v1/market/microstructure/:symbol (optional)
  - query params: interval, since, until
  - returns candlestick and trade-derived volatility and momentum

### Aggregation and sentiment routes

- GET /api/v1/sentiment/score
  - returns current sentiment score, label, and confidence

- GET /api/v1/sentiment/history
  - returns daily or hourly sentiment series

- GET /api/v1/dashboard/overview
  - returns all cards and chart payloads for fast page hydration

## 6. Data Contracts

All responses should include:

- source: dune | defillama | coingecko | alternative | exchange | blended
- asOf: ISO timestamp
- freshnessSec: integer
- data: typed payload
- meta: executionId/queryId/metric identifiers

Error contract:

- code: stable machine-readable code
- message: human-readable message
- retryable: boolean
- provider: dune | defillama | coingecko | alternative | exchange | internal

## 7. Sentiment Analysis Design

### Model Type

- Weighted factor score with configurable weights in config file

### Suggested factor groups

- Dune-derived factors
  - DEX volume acceleration
  - active wallet growth
  - stablecoin venue flow proxies
  - protocol usage concentration

- Free/low-cost derived factors
  - DefiLlama TVL momentum by chain and protocol
  - DefiLlama perps open-interest trend
  - CoinGecko volume and dominance proxies
  - Alternative.me fear and greed score
  - optional exchange microstructure volatility regime

### Scoring

- Normalize each feature using rolling z-score
- Compute weighted composite score S(t)
- Assign labels:
  - bullish when S(t) > 1
  - neutral when -1 <= S(t) <= 1
  - bearish when S(t) < -1

### Model outputs

- score
- label
- confidence
- top positive and negative contributors

## 8. Frontend Requirements

### Pages

- /dashboard
  - KPI cards
  - trend charts
  - sentiment state panel
  - market-state 3D scene

- /dashboard/flows
  - exchange and protocol flow deep dive

- /dashboard/sentiment
  - factor contribution analysis and regime history

### Chart standards

- Chart.js for line, bar, area, and mixed charts
- Shared chart config system for colors and scales
- Time-axis consistency across all charts

### Three.js role

- Use Three.js for a single high-value visual:
  - sentiment orb or market regime map driven by score and volatility
- Keep it lightweight and optional on low-performance devices

## 9. Suggested Folder Structure

```text
app/
  dashboard/
    page.tsx
    sentiment/page.tsx
    flows/page.tsx
  api/v1/
    dune/
    llama/
    coingecko/
    fng/
    market/
    sentiment/
    dashboard/
src/
  server/
    adapters/
      dune/
      defillama/
      coingecko/
      alternative/
      exchange/
    services/
      sentiment/
      dashboard/
    repositories/
  lib/
    schemas/
    utils/
  components/
    charts/
    three/
    dashboard/
data/
  raw/
  normalized/
  features/
  scores/
```

## 10. Security and Reliability

- Keep API keys server-side only
- Rate-limit public API routes
- Add retry with exponential backoff for provider errors
- Implement provider-specific circuit breaker logic
- Add schema validation at all boundaries
- Log request id and provider latency

## 11. Free-First Provider Strategy

The baseline stack should avoid high fixed provider costs and use free or low-cost sources first.

Provider roles:

- Dune: customizable onchain behavior and protocol activity
- DefiLlama: DeFi macro structure such as TVL, fees, and perps signals
- CoinGecko: broad market context and price/volume regime
- Alternative.me: compact daily sentiment anchor
- Exchange APIs (optional): market microstructure overlays

If premium providers are added later, place them behind the same adapter contract so frontend and service layers remain unchanged.

## 12. Minimum Viable Delivery Plan

### Phase 1

- Implement Dune adapter, execution polling, and latest result fetch
- Implement DefiLlama and CoinGecko adapters for 3 to 5 sentiment metrics
- Implement Alternative.me adapter for fear and greed enrichment
- Build /api/v1/sentiment/score and /api/v1/dashboard/overview
- Build dashboard page with Chart.js and one Three.js visual

### Phase 2

- Add historical scoring and factor contribution charts
- Add caching and background refresh jobs
- Add alerting when sentiment label changes

### Phase 3

- Add scenario analysis, strategy overlays, and backtest hooks

## 13. Recommended Additions

- Add OpenAPI spec generation for /api/v1 routes
- Add Playwright smoke tests for dashboard rendering
- Add lightweight data quality checks for missing points and stale data
- Add feature flags to enable or disable optional providers

## 14. Free Provider Mapping (Initial)

### Dune

- Query lifecycle and protocol-specific behavior metrics
- Inputs: saved query IDs and optional parameters

### DefiLlama

- TVL by protocol and chain
- DEX and derivatives summaries for macro flow context

### CoinGecko

- Price, market cap, and volume regime
- Cross-asset comparisons for breadth proxies

### Alternative.me

- Fear and greed daily sentiment anchor
- Fast fallback sentiment source with simple payload

### Exchange APIs (optional)

- Candlesticks and order-flow-adjacent proxies
- Use only as a secondary signal due to exchange-specific bias

## 15. Acceptance Criteria

- Dashboard renders with live data from API routes only
- No provider keys exposed to client bundles
- Sentiment score updates on schedule and is persisted
- API responses follow standardized contracts
- Charts and 3D visualization perform well on desktop and mobile
- Feature flags allow operation when one provider is unavailable
