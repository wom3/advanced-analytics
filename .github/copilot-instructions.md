# Project Guidelines

## Architecture

- Active app lives in `defi-analytica/` (Next.js App Router + TypeScript strict mode).
- Internal API routes live under `defi-analytica/app/api/v1/**`.
- Provider-specific logic belongs in adapters under `defi-analytica/src/server/adapters/**`.
- Shared API contracts live in `defi-analytica/src/server/api/envelope.ts` and are used across routes.
- Local development infra is defined in `defi-analytica/docker-compose.yml` (PostgreSQL + Redis).
- `requirements.md` and `TODO.md` describe planned providers/features; implement only what exists unless asked.

## Request Flow

- Every `/api/v1/*` request passes through `defi-analytica/proxy.ts` to attach `x-request-id` and emit request-received logs.
- Route handlers follow a consistent sequence: request ID -> rate limit check -> param/query parsing -> adapter call -> envelope response.
- Rate limiting is per-IP + pathname via `publicRateLimitKey()` and `takeToken()` in `defi-analytica/src/server/api/rate-limit.ts`.
- Success response contract: `{ source, asOf, freshnessSec, data, meta }`.
- Error response contract: `{ code, message, retryable, provider }`.

## Build And Test

- Run commands from `defi-analytica/` unless noted otherwise.
- Install deps: `npm i`
- Start local infra: `npm run infra:up`
- Dev server: `npm run dev`
- Unit tests: `npm test`
- Lint (zero warnings enforced): `npm run lint`
- Build production bundle: `npm run build`
- Format/check: `npm run format` / `npm run format:check`
- Stop local infra: `npm run infra:down`

## Testing Conventions

- Tests use `node:test` with `node:assert/strict`, executed through `npm test` (`tsx --test`).
- Prefer small deterministic service and utility tests over broad integration scaffolding unless the task needs end-to-end coverage.
- Match the existing `*.test.ts` style in `defi-analytica/src/server/services/**`: concise setup, direct assertions, and minimal abstraction.

## Conventions

- Keep route handlers thin; put provider/network logic in adapter modules under `defi-analytica/src/server/adapters/**`.
- Preserve existing response envelope shapes and headers (`x-request-id`, rate-limit headers) when adding endpoints.
- Follow existing parsing style: explicit `parse*` helpers for params/query values; return 400 on invalid user input.
- Use structured logger helpers (`logApiInfo`, `logApiWarn`, `logApiError`) from `defi-analytica/src/server/observability/logger.ts`.
- Reuse path alias imports (`@/*`) and keep TypeScript strictness settings intact in `defi-analytica/tsconfig.json`.

## Environment Notes

- Use `defi-analytica/.env.example` as the environment template.
- Dune-backed endpoints require `DUNE_API_KEY`.
- Persistence/cache features depend on `DATABASE_URL` and `REDIS_URL`.
- Optional exchange routes are gated by `ENABLE_EXCHANGE_SIGNALS`.
