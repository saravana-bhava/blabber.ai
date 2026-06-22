#!/usr/bin/env bash
# Align REMOTE Supabase migration history with supabase/migrations/*.sql
# Fixes: "Remote migration versions not found in local migrations directory"
#
# Usage:
#   STAGING_SUPABASE_DB_URL='postgresql://postgres.<ref>:<pass>@...pooler...:5432/postgres' \
#     npm run db:migrate:repair:remote
#
# Or:
#   SUPABASE_DB_URL='...' bash scripts/repair-remote-migrations.sh
#
# Use the Session pooler URI (Dashboard → Connect → Session mode), not db.<ref>.supabase.co
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

require_node_modules "$ROOT"
resolve_supabase_cli "$ROOT"

DB_URL="${SUPABASE_DB_URL:-${STAGING_SUPABASE_DB_URL:-${PRODUCTION_SUPABASE_DB_URL:-}}}"

# Optional: load from .env.staging / .env.prod if present (do not commit those files)
for envfile in .env.staging .env.prod; do
  if [[ -z "$DB_URL" && -f "$envfile" ]]; then
    line="$(grep -E '^(STAGING_|PRODUCTION_)?SUPABASE_DB_URL=' "$envfile" 2>/dev/null | head -1 || true)"
    if [[ -n "$line" ]]; then
      DB_URL="${line#*=}"
      DB_URL="${DB_URL#\"}"
      DB_URL="${DB_URL%\"}"
    fi
  fi
done

if [[ -z "$DB_URL" ]]; then
  echo "Set SUPABASE_DB_URL or STAGING_SUPABASE_DB_URL to the Session pooler Postgres URI."
  echo "Example host: aws-0-*.pooler.supabase.com:5432"
  exit 1
fi

MIGRATIONS_DIR="$ROOT/supabase/migrations"

echo "Collecting migration versions from repo..."
mapfile -t LOCAL_VERSIONS < <(
  ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
    | xargs -n1 basename \
    | sed -E 's/^([0-9]+)_.*/\1/' \
    | sort -u
)

echo "Reading remote migration history..."
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for remote migration repair."
  exit 1
fi
mapfile -t REMOTE_VERSIONS < <(
  psql "$DB_URL" -Atq -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
)

is_local_version() {
  local v="$1"
  for local in "${LOCAL_VERSIONS[@]}"; do
    [[ "$local" == "$v" ]] && return 0
  done
  return 1
}

PHANTOMS=()
for v in "${REMOTE_VERSIONS[@]}"; do
  [[ -z "$v" ]] && continue
  if ! is_local_version "$v"; then
    PHANTOMS+=("$v")
  fi
done

if [[ ${#PHANTOMS[@]} -gt 0 ]]; then
  echo "Phantom migrations on remote (not in repo): ${PHANTOMS[*]}"
  echo "Marking as reverted on remote..."
  "${SUPABASE[@]}" migration repair --db-url "$DB_URL" --status reverted "${PHANTOMS[@]}"
else
  echo "No phantom migrations on remote."
fi

echo "Pushing local migrations to remote..."
"${SUPABASE[@]}" db push --db-url "$DB_URL" --include-all

echo ""
echo "Remote migration status:"
"${SUPABASE[@]}" migration list --db-url "$DB_URL" | tail -12
