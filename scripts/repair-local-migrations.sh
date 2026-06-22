#!/usr/bin/env bash
# Align local Supabase migration history with supabase/migrations/*.sql
# and apply any pending migrations (fixes "Remote migration versions not found...").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

require_node_modules "$ROOT"
resolve_supabase_cli "$ROOT"

MIGRATIONS_DIR="$ROOT/supabase/migrations"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools or use Supabase Studio SQL."
  exit 1
fi

if ! psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "Local Postgres is not reachable at $DB_URL"
  echo "Start Supabase first: npm run infra:up"
  exit 1
fi

echo "Collecting migration versions from repo..."
mapfile -t LOCAL_VERSIONS < <(
  find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -printf '%f\n' 2>/dev/null \
    | sed -E 's/^([0-9]+)_.*/\1/' \
    | sort -u
)
# macOS/BSD find lacks -printf; fallback
if [[ ${#LOCAL_VERSIONS[@]} -eq 0 ]]; then
  mapfile -t LOCAL_VERSIONS < <(
    ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
      | xargs -n1 basename \
      | sed -E 's/^([0-9]+)_.*/\1/' \
      | sort -u
  )
fi

echo "Reading applied versions from local database..."
mapfile -t DB_VERSIONS < <(
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
for v in "${DB_VERSIONS[@]}"; do
  [[ -z "$v" ]] && continue
  if ! is_local_version "$v"; then
    PHANTOMS+=("$v")
  fi
done

if [[ ${#PHANTOMS[@]} -gt 0 ]]; then
  echo "Phantom migrations (in DB but not in repo): ${PHANTOMS[*]}"
  echo "Marking as reverted..."
  "${SUPABASE[@]}" migration repair --local --status reverted "${PHANTOMS[@]}"
else
  echo "No phantom migrations in history."
fi

echo "Applying pending local migrations..."
"${SUPABASE[@]}" migration up --local

# Safety: column added in 20260519120000 if history was skipped earlier
if [[ -f "$MIGRATIONS_DIR/20260519120000_add_creators_can_img_gen.sql" ]]; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATIONS_DIR/20260519120000_add_creators_can_img_gen.sql" >/dev/null
  psql "$DB_URL" -Atq -c \
    "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260519120000') ON CONFLICT DO NOTHING;" \
    >/dev/null || true
fi

echo ""
echo "Local migrations are in sync."
"${SUPABASE[@]}" migration list --local 2>/dev/null | tail -8 || true
