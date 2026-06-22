#!/usr/bin/env bash
# Fix a broken local Supabase stack (stale containers, partial starts).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

require_node_modules "$ROOT"
resolve_supabase_cli "$ROOT"
require_docker

echo "Stopping Supabase and removing project containers..."
"${SUPABASE[@]}" stop --no-backup 2>/dev/null || true
docker ps -aq --filter label=com.supabase.cli.project=blabber | xargs -r docker rm -f 2>/dev/null || true

echo "Starting fresh local stack..."
"${SUPABASE[@]}" start
"$ROOT/scripts/sync-local-env.sh"

echo "Repair complete."
