# Project Guidelines

## Big Picture (Current State)

- Active app lives in `defi-analytica/` (Next.js App Router + TypeScript strict mode).
- API boundary is internal route handlers under `defi-analytica/app/api/v1/**`.
- Provider-specific logic is isolated in adapters (`src/server/adapters/dune/client.ts`, `src/server/adapters/defillama/client.ts`, `src/server/adapters/coingecko/client.ts`, `src/server/adapters/alternative/client.ts`).
- Shared API contracts are centralized in `src/server/api/envelope.ts` and used by every route.
- `requirements.md` and `TODO.md` describe planned providers/features; implement only what exists unless asked.

## Request/Data Flow Patterns

- Every `/api/v1/*` request passes through `defi-analytica/proxy.ts` to attach `x-request-id` and emit request-received logs.
- Route handlers follow a consistent sequence: request ID -> rate limit check -> param/query parsing -> adapter call -> envelope response.
- Rate limiting is per-IP + pathname via `publicRateLimitKey()` and `takeToken()` in `src/server/api/rate-limit.ts`.
- Success response contract: `{ source, asOf, freshnessSec, data, meta }`.
- Error response contract: `{ code, message, retryable, provider }`.

## Dune Integration Conventions

- Dune routes are implemented at:
  - `app/api/v1/dune/queries/[queryId]/execute/route.ts`
  - `app/api/v1/dune/executions/[executionId]/status/route.ts`
  - `app/api/v1/dune/executions/[executionId]/results/route.ts`
  - `app/api/v1/dune/queries/[queryId]/latest/route.ts`
- Use `DuneApiError` for adapter failures; routes map this to stable API error codes (e.g. `DUNE_RESULTS_FAILED`).
- `src/server/adapters/dune/client.ts` normalizes provider payloads (`DuneNormalizedStatus`, `DuneNormalizedResult`) before returning.
- Dune calls use `fetch` with `AbortSignal.timeout(120_000)` and `cache: "no-store"`.
- In development, Dune key lookup prefers `.env.local` then `.env` in app root (`defi-analytica/`) before fallback to runtime env.

## Local Workflow (defi-analytica)

- Install deps: `npm i`
- Dev server: `npm run dev`
- Lint (enforced zero warnings): `npm run lint`
- Build production bundle: `npm run build`
- Format/check: `npm run format` / `npm run format:check`
- Environment template: `defi-analytica/.env.example` (`DUNE_API_KEY` needed for Dune-backed endpoints).

## Project-Specific Coding Rules

- Keep route handlers thin; put provider/network logic in adapter modules under `src/server/adapters/**`.
- Preserve existing response envelope shapes and headers (`x-request-id`, rate-limit headers) when adding endpoints.
- Follow existing parsing style: explicit `parse*` helpers for params/query values; return 400 on invalid user input.
- Use structured logger helpers (`logApiInfo`, `logApiWarn`, `logApiError`) from `src/server/observability/logger.ts`.
- Reuse path alias imports (`@/*`) and keep TypeScript strictness settings intact (`tsconfig.json`).
