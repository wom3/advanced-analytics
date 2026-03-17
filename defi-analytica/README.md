# defi-analytica

API-first crypto analytics app built with Next.js App Router and TypeScript strict mode.

Current implementation focuses on a Dune-backed `/api/v1` surface with normalized response envelopes, request tracing, and per-endpoint rate limiting.

## Quick Start

From this directory:

```bash
npm i
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` (or `.env`) with:

```env
NEXT_PUBLIC_APP_NAME=defi-analytica
DUNE_API_KEY=your_key_here
```

Notes:

- `DUNE_API_KEY` is required for Dune-backed endpoints.
- In development, Dune key lookup prefers `.env.local` then `.env` before runtime env vars.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - ESLint with zero warnings allowed
- `npm run lint:fix` - auto-fix lint issues
- `npm run format` - format repository files
- `npm run format:check` - verify formatting

## Implemented API Endpoints

Base: `/api/v1`

- `GET /api/v1`
- `POST /api/v1/dune/queries/:queryId/execute`
- `GET /api/v1/dune/executions/:executionId/status`
- `GET /api/v1/dune/executions/:executionId/results`
- `GET /api/v1/dune/queries/:queryId/latest`

### Response Contracts

Success envelope:

```json
{
  "source": "dune|internal",
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
  "provider": "dune|internal"
}
```

## Architecture Notes

- API middleware in `proxy.ts` injects `x-request-id` for `/api/v1/*` and logs request receipt.
- Route handlers stay thin: parse input, rate-limit, call adapters, return envelope responses.
- Dune provider logic lives in `src/server/adapters/dune/client.ts`.
- Shared API helpers:
  - `src/server/api/envelope.ts` for success/error JSON contracts
  - `src/server/api/rate-limit.ts` for in-memory per-IP+path limiting
  - `src/server/observability/logger.ts` for structured API logs

## Related Docs

- Repository overview: `../README.md`
- Product requirements: `../requirements.md`
- Implementation plan: `../TODO.md`
