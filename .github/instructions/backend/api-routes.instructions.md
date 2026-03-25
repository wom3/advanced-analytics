---
name: "API Route Handlers"
description: "Use when adding or editing Next.js API route handlers under defi-analytica/app/api/v1. Covers request-id flow, rate limiting, parsing, adapter delegation, cache usage, headers, and stable envelope/error behavior."
applyTo: "defi-analytica/app/api/v1/**/route.ts"
---
# API Route Handler Guidelines

- Keep route handlers thin: request setup, validation, adapter or service call, response mapping.
- Follow the established sequence: `getOrCreateRequestId()` -> `publicRateLimitKey()` / `takeToken()` -> parse params/query -> adapter or service call -> `jsonSuccess()` or `jsonError()`.
- Always preserve `x-request-id` and rate-limit headers on both success and error responses.
- Use explicit local parse helpers for params and query values; invalid user input should return 400 instead of falling through to provider errors.
- Map adapter failures to stable machine-readable API codes rather than leaking raw provider responses.
- Reuse cache helpers only where the endpoint follows the existing cache-aside pattern.
- Emit structured logs with `logApiInfo`, `logApiWarn`, and `logApiError`, including request metadata and duration.
- Do not move upstream provider calls into pages or browser code; route handlers remain the server boundary.