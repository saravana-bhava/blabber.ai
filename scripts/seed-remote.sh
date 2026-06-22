#!/usr/bin/env bash
# Run local dev seed SQL against a remote Supabase Postgres (staging/production).
#
# Usage (staging — reads .env.staging automatically):
#   npm run db:seed:remote
#   ./scripts/seed-remote.sh
#
# Or pass the DB URL as the first argument / set STAGING_SUPABASE_DB_URL.
#
# Optional:
#   SEED_ENV_FILE=.env.staging     — env file to load (default: .env.staging if present)
#   SEED_ADMIN_PASSWORD=...        — admin@blabber.ai password (default: Admin123!@#)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${SEED_ENV_FILE:-.env.staging}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  echo "Loaded $ENV_FILE"
fi

DB_URL="${1:-${SUPABASE_DB_URL:-${STAGING_SUPABASE_DB_URL:-}}}"

if [[ -z "$DB_URL" ]]; then
  echo "Usage: STAGING_SUPABASE_DB_URL='postgresql://...' $0"
  echo "   or: $0 'postgresql://...'"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required."
  exit 1
fi

ADMIN_PW="${SEED_ADMIN_PASSWORD:-Admin123!@#}"
LOCAL_PW='Admin123!@#'

SEED_FILES=(
  supabase/seed.sql
  supabase/seeds/dev_comprehensive.sql
  supabase/seeds/home_feed_patch.sql
  supabase/seeds/feed_showcase.sql
  supabase/seeds/feed_scroll_volume.sql
)

echo "Seeding remote database..."
echo "  admin@blabber.ai password: ${SEED_ADMIN_PASSWORD:-Admin123!@# (default)}"

for f in "${SEED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing $f"
    exit 1
  fi
  echo "  → $f"
  if [[ "$f" == "supabase/seed.sql" && "$ADMIN_PW" != "$LOCAL_PW" ]]; then
    sed "s/$(printf '%s' "$LOCAL_PW" | sed 's/[[\.*^$()+?{|]/\\&/g')/$(printf '%s' "$ADMIN_PW" | sed 's/[[\.*^$()+?{|]/\\&/g')/g" "$f" | psql "$DB_URL" -v ON_ERROR_STOP=1 -f -
  else
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  fi
done

echo "Done. Verify:"
psql "$DB_URL" -t -c "SELECT count(*) AS posts FROM public.posts;"
psql "$DB_URL" -t -c "SELECT id, email FROM auth.users WHERE email = 'admin@blabber.ai';"
