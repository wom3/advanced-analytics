# Advanced Analytics Implementation TODO

## Feature 01: Project Bootstrap

- [x] Initialize Next.js app with TypeScript and App Router
- [x] Add core dependencies: chart.js, react-chartjs-2, three, @react-three/fiber, @tanstack/react-query, zod
- [x] Add linting, formatting, and strict tsconfig rules
- [x] Add environment schema validation on startup

## Feature 02: API Foundation

- [x] Create API namespace under /api/v1
- [x] Add shared response envelope and error envelope utilities
- [x] Add request id middleware and basic structured logging
- [x] Add API rate limiting guard for public endpoints

## Feature 03: Dune Adapter

- [x] Implement execute query by queryId
- [x] Implement execution status polling
- [x] Implement execution result fetch
- [x] Implement latest query result fetch
- [x] Normalize Dune response to internal contract

## Feature 04: DefiLlama Adapter

- [x] Implement TVL endpoint integration
- [x] Implement historical chain and protocol fetch integration
- [x] Implement perps and volume summary integration
- [x] Normalize all series to shared time-series schema

## Feature 05: CoinGecko Adapter

- [x] Implement market chart data fetch by asset
- [x] Implement market-cap and volume extraction
- [x] Normalize and align intervals with other providers

## Feature 06: Alternative.me Adapter

- [x] Implement latest fear and greed fetch
- [x] Implement historical fear and greed fetch
- [x] Add source attribution metadata in responses

## Feature 07: Optional Exchange Adapter

- [x] Implement candlestick data fetch for selected symbols
- [x] Compute realized volatility and momentum proxy fields
- [x] Add feature flag to enable or disable exchange signals

## Feature 08: Data Persistence and Cache

- [x] Add PostgreSQL schema for raw, normalized, features, and scores
- [x] Add Redis cache layer for hot API responses
- [x] Add TTL policy by endpoint type
- [x] Add cache invalidation for scheduled refreshes

## Feature 09: Feature Engineering Service

- [x] Build time alignment across provider data
- [x] Build rolling z-score normalization pipeline
- [x] Build missing-data handling and imputation rules
- [x] Emit factor contribution table per timestamp

## Feature 10: Sentiment Scoring Service

- [x] Implement weighted factor score
- [x] Implement label classifier: bullish, neutral, bearish
- [x] Implement confidence score logic
- [x] Add configurable weights file and validation

## Feature 11: Dashboard Aggregation API

- [x] Implement /api/v1/dashboard/overview
- [x] Implement /api/v1/sentiment/score
- [x] Implement /api/v1/sentiment/history
- [x] Add freshness metadata and provider status block

## Feature 12: Frontend Dashboard Core

- [x] Build /dashboard page with KPI cards
- [x] Build trend chart widgets with Chart.js
- [x] Build sentiment state panel
- [x] Add auto-refresh and stale-data warnings

## Feature 13: Sentiment Deep Dive Page

- [x] Build /dashboard/sentiment page
- [x] Add factor contribution charts
- [x] Add regime history timeline chart
- [x] Add confidence trend chart

## Feature 14: Flows Deep Dive Page

- [x] Build /dashboard/flows page
- [x] Add DEX volume and TVL flow charts
- [x] Add protocol and chain filter controls
- [x] Add export to CSV and JSON actions

## Feature 15: Three.js Experience

- [x] Build a single market-state scene component
- [x] Map sentiment score to scene properties
- [x] Add reduced-motion and low-power fallback
- [x] Lazy-load Three.js bundle to preserve page speed

## Feature 16: Scheduler and Pipelines

- [x] Add local cron scripts for data refresh
- [x] Add GitHub Actions workflow for scheduled refresh
- [x] Add retry and alert policy for failed jobs
- [x] Add job run audit log and metrics

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
