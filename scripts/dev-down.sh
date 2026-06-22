#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.yml ]]; then
  docker compose --profile dev down 2>/dev/null || true
fi

if [[ -x "$ROOT/node_modules/.bin/supabase" ]] || command -v supabase >/dev/null 2>&1; then
  resolve_supabase_cli "$ROOT"
  "${SUPABASE[@]}" stop
else
  echo "Supabase CLI not installed; skipping supabase stop."
fi

echo "Local dev infra stopped."
