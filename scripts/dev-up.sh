#!/usr/bin/env bash
# Start local Supabase + optional Docker services, then sync .env.local.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

require_node_modules "$ROOT"
resolve_supabase_cli "$ROOT"
require_docker

echo "Starting Supabase local stack..."
"${SUPABASE[@]}" start

if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.yml ]]; then
  echo "Starting Docker Compose (dev profile)..."
  docker compose --profile dev up -d
fi

"$ROOT/scripts/sync-local-env.sh"

if [[ -x "$ROOT/scripts/repair-local-migrations.sh" ]]; then
  "$ROOT/scripts/repair-local-migrations.sh" || echo "Warning: migration repair failed (run: npm run db:migrate:repair)"
fi

echo ""
echo "Local dev infra is ready."
echo "  Next: npm run dev   (or: make dev)"
