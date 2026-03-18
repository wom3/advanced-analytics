# defi-analytica

API-first crypto analytics app built with Next.js App Router and TypeScript strict mode.

Current implementation provides Dune, DefiLlama, CoinGecko, Alternative.me, and sentiment/dashboard aggregation `/api/v1` routes with normalized response envelopes, request tracing, and per-endpoint rate limiting.

## Quick Start

From this directory:

```bash
npm i
cp .env.example .env.local
npm run infra:up
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` (or `.env`) with:

```env
NEXT_PUBLIC_APP_NAME=defi-analytica
DUNE_API_KEY=your_key_here
DATABASE_URL=postgresql://analytics:analytics@localhost:5433/analytics
REDIS_URL=redis://localhost:6379
ENABLE_EXCHANGE_SIGNALS=false
EXCHANGE_ALLOWED_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
```

Notes:

- `DUNE_API_KEY` is required for Dune-backed endpoints.
- In development, Dune key lookup prefers `.env.local` then `.env` before runtime env vars.
- `DATABASE_URL` points to PostgreSQL (local default uses Docker Compose service).
- `REDIS_URL` points to Redis cache (local default uses Docker Compose service).
- `ENABLE_EXCHANGE_SIGNALS=true` enables the optional exchange microstructure endpoint.
- `EXCHANGE_ALLOWED_SYMBOLS` controls which symbols can be queried for microstructure data.

Security baseline: Next.js is pinned at `16.1.7` (patched for current upstream advisories identified during this integration cycle).

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run built app
- `npm test` - run unit tests with the Node.js test runner (`tsx --test`)
- `npm run lint` - ESLint with zero warnings allowed
- `npm run lint:fix` - auto-fix lint issues
- `npm run format` - format repository files
- `npm run format:check` - verify formatting
- `npm run infra:up` - start local PostgreSQL + Redis via Docker Compose
- `npm run infra:down` - stop local PostgreSQL + Redis
- `npm run infra:logs` - tail PostgreSQL + Redis logs
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:migrate:dev` - create/apply a local development migration
- `npm run prisma:migrate:deploy` - apply committed migrations
- `npm run prisma:studio` - open Prisma Studio UI
- `npm run prisma:format` - format `prisma/schema.prisma`
- `npm run cache:invalidate` - invalidate Redis API cache keys (optionally by group)

## Local Data Infra (Docker Compose)

From this directory:

```bash
npm run infra:up
```

Services started by `docker-compose.yml`:

- PostgreSQL: `localhost:5433` (db/user/password: `analytics`)
- Redis: `localhost:6379`

Stop services:

```bash
npm run infra:down
```

## Prisma Setup (PostgreSQL)

Prisma schema and migrations live in `prisma/`:

- `prisma/schema.prisma`
- `prisma/migrations/*`

Typical local workflow:

```bash
npm run infra:up
npm run prisma:generate
npm run prisma:migrate:dev -- --name your_change_name
```

If `localhost:5433` is unavailable on your machine, update your local `DATABASE_URL` to a reachable PostgreSQL instance before running migrations.

## Redis API Cache (Feature 08)

Hot `/api/v1` responses use Redis cache-aside with endpoint-type TTLs.

TTL policy:

- `/api/v1/llama/metrics/:metric` -> 120s
- `/api/v1/coingecko/market/:asset` -> 120s
- `/api/v1/fng/latest` -> 60s
- `/api/v1/fng/history` -> 300s
- `/api/v1/sentiment/score` -> 60s
- `/api/v1/sentiment/history` -> 180s
- `/api/v1/dashboard/overview` -> 60s

Cache keys are prefixed with `aa:v1:http:` and include pathname + normalized query string.

For scheduled refresh jobs, invalidate cache groups before/after refresh:

```bash
# invalidate all groups
npm run cache:invalidate

# invalidate selected groups
REDIS_URL=redis://localhost:6379 npm run cache:invalidate -- fng.latest fng.history
```

You can also invalidate Feature 11 groups:

```bash
REDIS_URL=redis://localhost:6379 npm run cache:invalidate -- sentiment.score sentiment.history dashboard.overview
```

## Implemented API Endpoints

Base: `/api/v1`

- `GET /api/v1`
- `GET /api/v1/llama/metrics/:metric`
- `GET /api/v1/coingecko/market/:asset`
- `GET /api/v1/fng/latest`
- `GET /api/v1/fng/history`
- `GET /api/v1/market/microstructure/:symbol` (optional; feature-flagged)
- `GET /api/v1/sentiment/score`
- `GET /api/v1/sentiment/history`
- `GET /api/v1/dashboard/overview`
- `POST /api/v1/dune/queries/:queryId/execute`
- `GET /api/v1/dune/executions/:executionId/status`
- `GET /api/v1/dune/executions/:executionId/results`
- `GET /api/v1/dune/queries/:queryId/latest`

## How to Check Endpoints

Start the app first:

```bash
npm run dev
```

Use another terminal for checks.

### Check DefiLlama Endpoints

Root health:

```bash
curl -s "http://localhost:3000/api/v1" | jq
```

TVL by chain (Ethereum):

```bash
curl -s "http://localhost:3000/api/v1/llama/metrics/tvl?chain=Ethereum&interval=1d&since=1735689600" | jq
```

DEX volume by protocol (Uniswap):

```bash
curl -s "http://localhost:3000/api/v1/llama/metrics/volume?protocol=uniswap&interval=1d" | jq
```

Perps/open-interest by protocol (GMX):

```bash
curl -s "http://localhost:3000/api/v1/llama/metrics/perps?protocol=gmx&interval=1d" | jq
```

### Check CoinGecko Endpoints

Market chart by asset (Bitcoin):

```bash
curl -s "http://localhost:3000/api/v1/coingecko/market/bitcoin?interval=1d&since=1735689600" | jq
```

### Check Alternative.me (Fear & Greed) Endpoints

Latest reading:

```bash
curl -s "http://localhost:3000/api/v1/fng/latest" | jq
```

History (limit + optional range filters):

```bash
curl -s "http://localhost:3000/api/v1/fng/history?limit=30&since=1735689600" | jq
```

### Check Optional Exchange Microstructure Endpoint

Enable in `.env.local`:

```env
ENABLE_EXCHANGE_SIGNALS=true
EXCHANGE_ALLOWED_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
```

Then query:

```bash
curl -s "http://localhost:3000/api/v1/market/microstructure/BTCUSDT?interval=1h&limit=200" | jq
```

The response includes OHLCV candlesticks plus computed `realizedVolatility` and `momentum` proxy fields.

### Check Dune Endpoints

Execute a query (replace with your Dune query id):

```bash
QUERY_ID=1215383
EXECUTION_ID=$(curl -s -X POST "http://localhost:3000/api/v1/dune/queries/$QUERY_ID/execute" \
  -H "content-type: application/json" \
  -d '{}' | jq -r '.data.executionId')
echo "$EXECUTION_ID"
```

Check execution status:

```bash
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/status" | jq
```

Fetch execution results:

```bash
curl -s "http://localhost:3000/api/v1/dune/executions/$EXECUTION_ID/results?limit=100" | jq
```

Fetch latest cached result for a query:

```bash
curl -s "http://localhost:3000/api/v1/dune/queries/$QUERY_ID/latest?limit=100" | jq
```

Notes:

- Dune checks require `DUNE_API_KEY` in `.env.local` or `.env`.
- The response includes `x-request-id` and rate-limit headers on every endpoint.

### Check Sentiment and Dashboard Aggregation Endpoints (Feature 11)

Demo-mode smoke checks (deterministic, does not require upstream providers):

```bash
curl -s "http://localhost:3000/api/v1/sentiment/score?mode=demo&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
curl -s "http://localhost:3000/api/v1/sentiment/history?mode=demo&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
curl -s "http://localhost:3000/api/v1/dashboard/overview?mode=demo&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
```

Live-mode checks (uses upstream providers with fallback-to-synthetic if unavailable):

```bash
curl -s "http://localhost:3000/api/v1/sentiment/score?mode=live&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
curl -s "http://localhost:3000/api/v1/sentiment/history?mode=live&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
curl -s "http://localhost:3000/api/v1/dashboard/overview?mode=live&interval=1h&points=72&asset=bitcoin&chain=Ethereum" | jq
```

### Response Contracts

Success envelope:

```json
{
  "source": "dune|defillama|coingecko|alternative|exchange|internal",
  "asOf": "ISO timestamp",
  "freshnessSec": 0,
  "data": {},
  "meta": {}
}
```

Error envelope:

```json
{
  "code": "MACHINE_READABLE_CODE",
  "message": "human-readable message",
  "retryable": true,
  "provider": "dune|defillama|coingecko|alternative|exchange|internal"
}
```

## Architecture Notes

- API middleware in `proxy.ts` injects `x-request-id` for `/api/v1/*` and logs request receipt.
- Route handlers stay thin: parse input, rate-limit, call adapters, return envelope responses.
- Dune provider logic lives in `src/server/adapters/dune/client.ts`.
- Feature engineering logic for aligned factors, imputation, rolling z-scores, and contribution rows lives in `src/server/services/feature-engineering/service.ts`.
- Sentiment scoring logic for weighted composite score, regime label classification, confidence, and contributor ranking lives in `src/server/services/sentiment-scoring/service.ts`.
- Sentiment factor weights and thresholds are configured in `src/server/services/sentiment-scoring/weights.json` and validated with Zod at load time.
- Dashboard aggregation logic for blending provider factors, emitting provider-status metadata, and serving sentiment/dashboard payloads lives in `src/server/services/dashboard/service.ts`.
- Shared API helpers:
  - `src/server/api/envelope.ts` for success/error JSON contracts
  - `src/server/api/rate-limit.ts` for in-memory per-IP+path limiting
  - `src/server/observability/logger.ts` for structured API logs

## Related Docs

- Repository overview: `../README.md`
- Product requirements: `../requirements.md`
- Implementation plan: `../TODO.md`
