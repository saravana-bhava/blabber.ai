#!/usr/bin/env bash
# Merge Supabase local credentials from `supabase status` into .env.local.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/dev-common.sh
source "$ROOT/scripts/lib/dev-common.sh"

ENV_FILE="${1:-.env.local}"
EXAMPLE="${ROOT}/.env.example"

require_node_modules "$ROOT"
resolve_supabase_cli "$ROOT"

if ! "${SUPABASE[@]}" status >/dev/null 2>&1; then
  echo "Local Supabase is not running. Start it with: npm run infra:up"
  exit 1
fi

# JSON output (Supabase CLI v2+); strip non-JSON lines some versions print to stdout
STATUS_JSON="$("${SUPABASE[@]}" status --output json 2>/dev/null | sed -n '/^{/,$p' || true)"
if [[ -z "$STATUS_JSON" ]]; then
  echo "Could not read supabase status --output json. Update the Supabase CLI."
  exit 1
fi

API_URL="$(echo "$STATUS_JSON" | node -e "
const s = JSON.parse(require('fs').readFileSync(0,'utf8'));
const api = s.API_URL || s.api?.url || '';
process.stdout.write(api);
")"

ANON_KEY="$(echo "$STATUS_JSON" | node -e "
const s = JSON.parse(require('fs').readFileSync(0,'utf8'));
const k = s.ANON_KEY || s.api?.anon_key || '';
process.stdout.write(k);
")"

SERVICE_KEY="$(echo "$STATUS_JSON" | node -e "
const s = JSON.parse(require('fs').readFileSync(0,'utf8'));
const k = s.SERVICE_ROLE_KEY || s.service_role_key || '';
process.stdout.write(k);
")"

DB_URL="$(echo "$STATUS_JSON" | node -e "
const s = JSON.parse(require('fs').readFileSync(0,'utf8'));
const u = s.DB_URL || s.db?.url || '';
process.stdout.write(u);
")"

if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
  echo "Missing API_URL or ANON_KEY from supabase status."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$EXAMPLE" ]]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Created $ENV_FILE from .env.example"
  else
    touch "$ENV_FILE"
    echo "Created empty $ENV_FILE"
  fi
fi

upsert() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${value}" >>"$ENV_FILE"
  fi
}

upsert "NEXT_PUBLIC_SUPABASE_URL" "$API_URL"
upsert "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"
upsert "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_KEY"
upsert "DATABASE_URL" "$DB_URL"
upsert "NEXT_PUBLIC_SITE_URL" "http://127.0.0.1:3000"

echo "Updated $ENV_FILE with local Supabase credentials."
echo "  API:    $API_URL"
echo "  Studio: http://127.0.0.1:54323"
echo "  Inbucket (auth email): http://127.0.0.1:54324"
