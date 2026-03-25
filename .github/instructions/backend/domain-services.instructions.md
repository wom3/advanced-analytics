---
name: "Domain Services"
description: "Use when modifying internal domain services in defi-analytica/src/server/services, including dashboard, feature-engineering, and sentiment-scoring logic. Covers deterministic transformations, composition across adapters, and testability."
applyTo: "defi-analytica/src/server/services/**/*.ts"
---
# Domain Service Guidelines

- Keep service code focused on business logic, aggregation, normalization, and derived analytics rather than transport concerns.
- Compose provider data through adapters and shared helpers instead of embedding fetch logic directly in services.
- Favor deterministic transformations and explicit defaults so services remain easy to test in demo and live modes.
- Preserve existing exported result shapes because pages and routes consume them directly.
- When logic grows, extract small pure helpers instead of expanding one long orchestration function.