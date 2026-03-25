---
name: "Cache And Observability"
description: "Use when changing Redis HTTP cache logic, cache policy, invalidation scripts, or API logging helpers. Covers cache-key stability, TTL policy alignment, and structured observability patterns."
applyTo: "defi-analytica/src/server/cache/**/*.ts,defi-analytica/src/server/observability/**/*.ts,defi-analytica/scripts/invalidate-cache.mjs"
---
# Cache And Observability Guidelines

- Keep cache keys stable and derived from normalized request inputs so identical requests coalesce reliably.
- Align TTL changes with endpoint freshness expectations and existing cache group naming.
- Prefer explicit cache invalidation wiring over silent implicit behavior.
- Logging should stay structured and machine-friendly; keep event names stable and include request context when available.
- Avoid mixing cache policy, cache storage, and logging concerns in one helper when a smaller focused module is clearer.