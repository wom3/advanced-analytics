---
name: "Node Test Style"
description: "Use when adding or updating unit tests in this repo, especially src/**/*.test.ts files run by tsx with node:test. Covers assertion style, deterministic fixtures, and matching the existing service test patterns."
applyTo: "defi-analytica/src/**/*.test.ts"
---
# Test Guidelines

- Use `node:test` and `node:assert/strict` as the default testing style.
- Prefer deterministic inputs and direct assertions over heavy mocking unless external behavior must be isolated.
- Match existing tests: one clear behavior per test, concise setup, and assertions on observable outputs.
- Keep tests close to the module contract they protect; validate shape, counts, labels, and fallback behavior where relevant.
- Avoid brittle timing or network-dependent tests in the unit suite.