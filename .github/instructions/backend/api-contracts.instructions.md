---
name: "API Contracts And Shared Server Primitives"
description: "Use when editing shared API primitives such as envelope helpers, rate limiting, or request-id utilities in defi-analytica/src/server/api. Covers backward-compatible response contracts and shared header behavior."
applyTo: "defi-analytica/src/server/api/**/*.ts"
---
# API Contract Guidelines

- Treat shared API helpers as compatibility-sensitive code because every route depends on them.
- Preserve the success envelope shape `{ source, asOf, freshnessSec, data, meta }` and error envelope shape `{ code, message, retryable, provider }` unless the task explicitly changes the public contract.
- Keep request-id handling centralized and ensure helpers continue to support `x-request-id` propagation.
- Shared header behavior should remain uniform across routes; avoid route-specific branching in common helpers.
- Prefer additive changes over breaking renames when evolving shared API utilities.