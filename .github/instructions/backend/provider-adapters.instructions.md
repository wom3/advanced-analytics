---
name: "Provider Adapters"
description: "Use when implementing or refactoring provider adapters in defi-analytica/src/server/adapters. Covers fetch behavior, normalization, custom adapter errors, and keeping provider-specific logic out of route handlers."
applyTo: "defi-analytica/src/server/adapters/**/*.ts"
---
# Provider Adapter Guidelines

- Keep upstream API details in adapters: URLs, auth headers, provider params, normalization, and provider-specific error handling.
- Export typed normalized results that route handlers can use without understanding raw provider payloads.
- Use custom adapter error classes with `status` and `retryable` metadata so routes can map failures into stable API error codes.
- Prefer small normalization helpers over passing raw provider payloads through the rest of the app.
- Preserve existing fetch behavior where present, including `cache: "no-store"` and explicit timeouts for upstream calls.
- Keep environment lookup and feature-flag handling centralized in adapter or env helpers rather than duplicating it across routes.