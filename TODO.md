# Advanced Analytics Implementation TODO

## Feature 01: Project Bootstrap

- [x] Initialize Next.js app with TypeScript and App Router
- [x] Add core dependencies: chart.js, react-chartjs-2, three, @react-three/fiber, @tanstack/react-query, zod
- [x] Add linting, formatting, and strict tsconfig rules
- [x] Add environment schema validation on startup

## Feature 02: API Foundation

- [ ] Create API namespace under /api/v1
- [ ] Add shared response envelope and error envelope utilities
- [ ] Add request id middleware and basic structured logging
- [ ] Add API rate limiting guard for public endpoints

## Feature 03: Dune Adapter

- [ ] Implement execute query by queryId
- [ ] Implement execution status polling
- [ ] Implement execution result fetch
- [ ] Implement latest query result fetch
- [ ] Normalize Dune response to internal contract

## Feature 04: DefiLlama Adapter

- [ ] Implement TVL endpoint integration
- [ ] Implement historical chain and protocol fetch integration
- [ ] Implement perps and volume summary integration
- [ ] Normalize all series to shared time-series schema

## Feature 05: CoinGecko Adapter

- [ ] Implement market chart data fetch by asset
- [ ] Implement market-cap and volume extraction
- [ ] Normalize and align intervals with other providers

## Feature 06: Alternative.me Adapter

- [ ] Implement latest fear and greed fetch
- [ ] Implement historical fear and greed fetch
- [ ] Add source attribution metadata in responses

## Feature 07: Optional Exchange Adapter

- [ ] Implement candlestick data fetch for selected symbols
- [ ] Compute realized volatility and momentum proxy fields
- [ ] Add feature flag to enable or disable exchange signals

## Feature 08: Data Persistence and Cache

- [ ] Add PostgreSQL schema for raw, normalized, features, and scores
- [ ] Add Redis cache layer for hot API responses
- [ ] Add TTL policy by endpoint type
- [ ] Add cache invalidation for scheduled refreshes

## Feature 09: Feature Engineering Service

- [ ] Build time alignment across provider data
- [ ] Build rolling z-score normalization pipeline
- [ ] Build missing-data handling and imputation rules
- [ ] Emit factor contribution table per timestamp

## Feature 10: Sentiment Scoring Service

- [ ] Implement weighted factor score
- [ ] Implement label classifier: bullish, neutral, bearish
- [ ] Implement confidence score logic
- [ ] Add configurable weights file and validation

## Feature 11: Dashboard Aggregation API

- [ ] Implement /api/v1/dashboard/overview
- [ ] Implement /api/v1/sentiment/score
- [ ] Implement /api/v1/sentiment/history
- [ ] Add freshness metadata and provider status block

## Feature 12: Frontend Dashboard Core

- [ ] Build /dashboard page with KPI cards
- [ ] Build trend chart widgets with Chart.js
- [ ] Build sentiment state panel
- [ ] Add auto-refresh and stale-data warnings

## Feature 13: Sentiment Deep Dive Page

- [ ] Build /dashboard/sentiment page
- [ ] Add factor contribution charts
- [ ] Add regime history timeline chart
- [ ] Add confidence trend chart

## Feature 14: Flows Deep Dive Page

- [ ] Build /dashboard/flows page
- [ ] Add DEX volume and TVL flow charts
- [ ] Add protocol and chain filter controls
- [ ] Add export to CSV and JSON actions

## Feature 15: Three.js Experience

- [ ] Build a single market-state scene component
- [ ] Map sentiment score to scene properties
- [ ] Add reduced-motion and low-power fallback
- [ ] Lazy-load Three.js bundle to preserve page speed

## Feature 16: Scheduler and Pipelines

- [ ] Add local cron scripts for data refresh
- [ ] Add GitHub Actions workflow for scheduled refresh
- [ ] Add retry and alert policy for failed jobs
- [ ] Add job run audit log and metrics

## Feature 17: Testing

- [ ] Add unit tests for adapters and scoring logic
- [ ] Add contract tests for API response schemas
- [ ] Add integration tests for dashboard overview API
- [ ] Add Playwright smoke tests for key dashboard pages

## Feature 18: Observability and Reliability

- [ ] Add provider latency and error-rate metrics
- [ ] Add circuit breaker and fallback logic per provider
- [ ] Add feature flags for optional providers
- [ ] Add health endpoint with provider readiness checks

## Feature 19: Security and Compliance

- [ ] Verify no secrets are exposed to client bundles
- [ ] Add strict CORS and header policies for APIs
- [ ] Add dependency audit and lockfile checks in CI
- [ ] Verify attribution requirements for external free APIs

## Feature 20: Release Checklist

- [ ] Run full test suite and smoke tests
- [ ] Validate data freshness and sentiment output quality
- [ ] Benchmark dashboard performance on desktop and mobile
- [ ] Prepare v1 release notes and known limitations

## Feature 21: Optional Architecture Expansion

- [ ] Implement optional FastAPI service as a separate backend runtime for scaling
- [ ] Mirror /api/v1 contracts between Next.js Route Handlers and FastAPI service
- [ ] Add adapter abstraction layer to switch between internal and external API runtime
- [ ] Add deployment profile that supports Next.js-only and Next.js + FastAPI modes

## Feature 22: Optional Provider Expansion

- [ ] Add optional exchange microstructure endpoint and route wiring for /api/v1/market/microstructure/:symbol
- [ ] Add optional premium provider adapter interface without changing frontend contracts
- [ ] Add provider capability registry for free-only and mixed-provider modes
- [ ] Add configuration toggles for provider priority and fallback order

## Feature 23: Out-of-Scope Backlog (Post-v1)

- [ ] Implement trade execution module with strict separation from analytics services
- [ ] Add broker integration abstraction for centralized and decentralized execution venues
- [ ] Build multi-tenant authentication and authorization model
- [ ] Build billing and usage metering by workspace, tenant, and API key
- [ ] Design MLOps retraining pipeline for feature drift and score recalibration
- [ ] Add model registry, evaluation gates, and scheduled retraining workflows