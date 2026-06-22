# Local development (Supabase + Docker)

Run the full Blabber stack on your machine: Supabase (Postgres, Auth, Storage, Studio) via the Supabase CLI, optional Docker services, and automated env sync.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (running)
- Node.js 20+
- `npm install` in the project root

## Quick start

```bash
# First time
cp .env.example .env.local
npm run setup          # starts Supabase, optional docker dev profile, syncs keys

# Daily
npm run dev            # Next.js only (if infra already up)
# or
make dev               # infra + sync .env.local + Next.js
```

Open:

| Service | URL |
|---------|-----|
| App | http://127.0.0.1:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Auth emails (Inbucket) | http://127.0.0.1:54324 |
| Mailpit (optional) | http://127.0.0.1:8025 |

## Commands

### npm

| Script | Description |
|--------|-------------|
| `npm run setup` | `infra:up` + `env:sync` |
| `npm run infra:up` | Start Supabase + docker dev profile |
| `npm run infra:down` | Stop everything |
| `npm run infra:status` | Local URLs and keys |
| `npm run env:sync` | Write Supabase keys into `.env.local` |
| `npm run db:reset` | Re-run all migrations + `supabase/seed.sql` |
| `npm run dev:all` | Full stack then Next.js |
| `npm run db:push` | Push migrations to **linked** remote project |

### Make

| Target | Description |
|--------|-------------|
| `make setup` | First-time local setup |
| `make up` / `make down` | Start / stop infra |
| `make dev` | Infra + Next.js |
| `make db-reset` | Reset local database |
| `make sync-env` | Update `.env.local` from `supabase status` |

## Environment files

- **`.env.example`** — committed template (local defaults; copy to `.env.local`).
- **`.env.local`** — your secrets (gitignored). Supabase URL/keys are updated by `npm run env:sync`.

Fill Stripe, Resend, Onyx, etc. with test keys when you work on those features.

## Database

Migrations live in `supabase/migrations/`. Local seed data: `supabase/seed.sql` (runs on `db reset`).

```bash
npm run db:reset       # fresh local DB
npx supabase migration new my_change
```

Link a remote project (optional):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npm run db:push
```

## Docker Compose

`docker-compose.yml` only adds optional **dev** services (Mailpit). Supabase itself is **not** duplicated in Compose—the CLI manages those containers.

```bash
docker compose --profile dev up -d
```

## CI / deploying migrations

Workflow: [`.github/workflows/supabase.yml`](../.github/workflows/supabase.yml)

| Trigger | What runs |
|---------|-----------|
| PR touching `supabase/` | Local `supabase start` — smoke-test that migrations apply |
| Push to `staging` | `supabase db push` against **staging** database |
| Push to `main` | `supabase db push` against **production** database |
| Manual dispatch | Choose staging or production |

### GitHub setup

1. **Environments** (repo → Settings → Environments):
   - `staging` — optional deployment branch rule: `staging`
   - `production` — optional deployment branch rule: `main` (enable required reviewers if you want)

2. **Secrets** — pick one approach (workflow routes by branch / manual input):

   **Option A — repo secrets with `STAGING_` / `PRODUCTION_` prefixes** (explicit routing):

   | Secret | Value |
   |--------|--------|
   | `STAGING_SUPABASE_DB_URL` | Staging Postgres URI (Dashboard → Database → URI) |
   | `PRODUCTION_SUPABASE_DB_URL` | Production Postgres URI |

   Or per env: `STAGING_SUPABASE_PROJECT_REF` + `STAGING_SUPABASE_DB_PASSWORD` (and `PRODUCTION_*`).

   **Option B — GitHub Environment secrets** (same names on each environment):

   | Secret | Value |
   |--------|--------|
   | `SUPABASE_DB_URL` | Full Postgres URI on the `staging` env, different value on `production` |

   Or per env: `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`.

   The workflow sets `TARGET_ENV` to `staging` (push to `staging` branch) or `production` (push to `main`). Repo-prefixed secrets take precedence; environment secrets are the fallback.

3. Do **not** commit database passwords or service role keys to the repo.

If Option A fails (pooler/region host), paste the exact URI from the dashboard into `SUPABASE_DB_URL`.

**CI `network is unreachable` to `db.<ref>.supabase.co`:** that hostname is **IPv6-only**. GitHub Actions often cannot reach it. Do **not** build URLs as `db.<ref>.supabase.co`.

- **Option A:** `STAGING_SUPABASE_DB_URL` = **Session pooler** URI from Dashboard → **Connect** → Session mode (`*.pooler.supabase.com:5432`).
- **Option B:** `STAGING_SUPABASE_PROJECT_REF` + `STAGING_SUPABASE_ACCESS_TOKEN` + `STAGING_SUPABASE_DB_PASSWORD` → workflow runs `supabase link` + `db push`.

Project ref = ID in `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://kzfdnjbntgzsyvqprxvk.supabase.co` → ref `kzfdnjbntgzsyvqprxvk`). That is **not** the same as a custom API domain like `data.blabber.ai`.

**CI `dial unix /var/run/postgresql`:** empty/malformed `DB_URL`, or raw `@` in password inside a URI — use ref + password or an encoded pooler URI.

**CI `Remote migration versions not found in local migrations directory`:** the remote DB has migration IDs that are not in `supabase/migrations/` (e.g. `20260602100000`). From your machine:

```bash
STAGING_SUPABASE_DB_URL='postgresql://postgres.<ref>:<encoded-pass>@aws-1-us-east-2.pooler.supabase.com:5432/postgres' \
  npm run db:migrate:repair:remote
```

Or add `STAGING_SUPABASE_DB_URL=...` to `.env.staging` (gitignored) and run `npm run db:migrate:repair:remote`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port in use | `npm run infra:down`, or change ports in `supabase/config.toml` |
| App hits production | Check `.env.local` overrides; run `npm run env:sync` |
| Migration fails | Fix SQL, then `npm run db:reset` |
| Docker not running | Start Docker daemon |
| Partial start / Studio missing | `npm run infra:repair` |
