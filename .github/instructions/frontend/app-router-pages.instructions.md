---
name: "App Router Pages And Layouts"
description: "Use when editing Next.js App Router pages or layouts under defi-analytica/app outside API routes. Covers metadata, server-component defaults, and keeping page-level concerns separate from backend route logic."
applyTo: "defi-analytica/app/**/page.tsx,defi-analytica/app/**/layout.tsx"
---
# App Router Page Guidelines

- Treat pages and layouts as App Router entry points, not as a place for backend provider logic.
- Keep page-level metadata explicit and typed when metadata is part of the file.
- Prefer server components by default unless the file needs client-only behavior.
- Pull business logic into shared services or nearby helpers instead of expanding page files into orchestration layers.
- Keep API concerns in `defi-analytica/app/api/v1/**` route handlers rather than mixing them into page components.