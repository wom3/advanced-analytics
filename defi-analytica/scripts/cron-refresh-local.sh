#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

if [[ -f ".env.local" ]]; then
  # Load local project env vars for cron contexts that don't have interactive shell env.
  set -a
  # shellcheck disable=SC1091
  source ./.env.local
  set +a
fi

REFRESH_ARGS=()
if [[ "${REFRESH_DRY_RUN:-false}" == "true" ]]; then
  REFRESH_ARGS+=("--dry-run")
fi

if [[ -n "${REFRESH_TIMEOUT_MS:-}" ]]; then
  REFRESH_ARGS+=("--timeout-ms" "$REFRESH_TIMEOUT_MS")
fi

node scripts/refresh-data.mjs --base-url "${REFRESH_BASE_URL:-http://localhost:3000}" "${REFRESH_ARGS[@]}"
