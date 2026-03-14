# Project Guidelines

## Code Style
- Prefer TypeScript strict mode for new app and API code.
- Keep Python changes minimal and focused in `tools/dune-analytics-mcp/`.
- Preserve existing public interfaces and output formats unless a task explicitly changes them.
- Use clear, small functions with explicit error handling and typed response contracts.

## Architecture
- This workspace currently contains a working Dune MCP server in `tools/dune-analytics-mcp/`.
- The target product is an API-first analytics dashboard described in `requirements.md` and planned in `TODO.md`.
- Use provider adapters behind internal API routes. Do not call external providers directly from client-side UI code.
- Keep provider-specific logic in adapters and expose normalized contracts to services and routes.

## Build and Test
- For MCP server setup, from `tools/dune-analytics-mcp/`:
  - Create env: `python3.13 -m venv .venv`
  - Install deps: `.venv/bin/python -m pip install -U pip mcp[cli] httpx pandas python-dotenv socksio`
  - Run server: `.venv/bin/python main.py`
  - Run query smoke test: `.venv/bin/python run_dune_query.py <query_id>`
- Ensure `DUNE_API_KEY` is set in `tools/dune-analytics-mcp/.env` before running Dune scripts.

## Conventions
- MCP tools should return stable string outputs and fail gracefully with readable error messages.
- Dune query execution is asynchronous. Always poll execution status until completion before fetching results.
- Account for endpoint/state variations in Dune API responses (for compatibility across API versions).
- Keep request timeouts realistic for analytics workloads (longer-running queries are expected).
- For new dashboard APIs, standardize responses with source, asOf, freshness, data, and meta fields.

## Pitfalls
- Proxy environment variables can break HTTP clients unexpectedly. If needed, disable inherited proxy env for provider calls.
- Missing or misplaced `.env` files are a common failure mode for local execution.
- Do not hardcode secrets or expose provider keys in client bundles.

## Source of Truth
- Product and architecture requirements: `requirements.md`
- Feature-by-feature implementation plan: `TODO.md`
