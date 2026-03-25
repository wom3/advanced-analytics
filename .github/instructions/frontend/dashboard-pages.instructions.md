---
name: "Dashboard Pages And Components"
description: "Use when editing dashboard pages or related components under app/dashboard. Covers server-first data loading, existing visual language, and keeping UI changes aligned with current dashboard patterns."
applyTo:
  - "defi-analytica/app/dashboard/**/*.ts"
  - "defi-analytica/app/dashboard/**/*.tsx"
---
# Dashboard UI Guidelines

- Preserve the existing dashboard visual language unless the task explicitly asks for a redesign.
- Keep data loading server-first where the current page already does so; fetch through internal services or routes, not browser-side provider calls.
- Reuse nearby helper patterns for formatting numbers, percentages, freshness state, and provider health instead of introducing competing utilities.
- Keep chart and widget props explicit and typed; avoid passing raw provider payloads into UI components.
- Maintain clear loading, stale-data, and provider-readiness states where the page already surfaces them.
- Favor readable page composition and small local helpers over broad abstraction when matching the surrounding file style.