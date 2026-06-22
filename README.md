# Blabber AI

Blabber is a creator economy platform where fans discover creators, subscribe, message, and buy products—while creators monetize through subscriptions, tips, pay-per-view content, a built-in marketplace, and AI-powered voice and chat. The app is a **Next.js 15** frontend with **Supabase** (Postgres, Auth, Storage, Realtime) and integrations for payments (Stripe, Onyx), identity (Veriff), and transactional email (Resend).

## Tech stack

- **App:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (migrations in `supabase/migrations/`)
- **Local infra:** Supabase CLI (Docker), optional Mailpit via Docker Compose
- **Email templates:** React Email (`src/emails/`)

## Prerequisites

Install everything below before `make setup`. Optional third-party keys (Stripe, Resend, etc.) are only needed when you work on those features—see [Documentation](#documentation).

### Docker

Runs the local Supabase stack (Postgres, Auth, Storage, Studio).

- **Docs:** [Install Docker](https://docs.docker.com/get-docker/)
- **Linux (Ubuntu/Debian):**

  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
  ```

- **macOS:** Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/), open it once so the daemon is running, then `docker run hello-world`.

Verify: `docker info` (no permission errors).

### Node.js 20+ and npm

Used for the Next.js app, scripts, and the Supabase CLI (project devDependency).

- **Docs:** [nodejs.org](https://nodejs.org/) · [Download Node.js](https://nodejs.org/en/download)
- **Linux (nvm — recommended):**

  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # restart shell, then:
  nvm install 20
  nvm use 20
  ```

- **macOS (Homebrew):**

  ```bash
  brew install node@20
  brew link --overwrite node@20
  ```

`npm` is included with Node.js. Verify: `node -v` (v20+) and `npm -v`.

### Make

Runs the `Makefile` targets (`make dev`, `make setup`, etc.).

- **Docs:** [GNU Make](https://www.gnu.org/software/make/)
- **Linux:** usually preinstalled; if not: `sudo apt-get install -y build-essential`
- **macOS:** install Xcode Command Line Tools: `xcode-select --install`

Verify: `make --version`.

### Supabase CLI

Applies migrations locally and in CI. This repo pins it in `package.json`; you do **not** need a global install—`npx supabase` and `npm run` scripts use the project version after `npm install`.

- **Docs:** [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- **Project (after clone):**

  ```bash
  npm install
  npx supabase --version
  ```

Optional global install: `npm install -g supabase` (same [CLI guide](https://supabase.com/docs/guides/cli/getting-started)).


## Development setup


### First time

```bash
git clone https://github.com/blabber-ai-main/blabber
cd blabber
npm install
cp .env.example .env.local
make setup
```

`make setup` starts the local Supabase stack, syncs API keys into `.env.local`, and prints a reminder to add any third-party test keys you need.

### Daily workflow

```bash
make dev
```

### Make commands

| Command | Description |
|---------|-------------|
| `make help` | List available targets |
| `make setup` | First-time: `up` + `sync-env` |
| `make up` | Start Supabase (+ optional Mailpit) |
| `make down` | Stop local infra |
| `make dev` | `up` + `sync-env` + `npm run dev` |
| `make sync-env` | Write Supabase keys from `supabase status` into `.env.local` |
| `make status` | Local Supabase URLs and keys |
| `make db-reset` | Reset local DB (migrations + `supabase/seed.sql`) |
| `make repair` | Fix broken or partial Supabase Docker state |

### Local URLs

| Service | URL |
|---------|-----|
| App | http://127.0.0.1:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Auth emails (Inbucket) | http://127.0.0.1:54324 |

## Environment variables

Copy **[`.env.example`](.env.example)** to **`.env.local`** (gitignored). Supabase URL and keys are filled by `make sync-env` when using local Supabase; add Stripe, Resend, and other keys when working on those integrations.

## Deployment

Database migrations run on push to **`staging`** and **`main`** when `supabase/migrations/` changes. Configure `STAGING_*` / `PRODUCTION_*` repo secrets or per-environment `SUPABASE_*` secrets on GitHub Environments `staging` and `production`. Details: [CI / deploying migrations](docs/LOCAL_DEVELOPMENT.md#ci--deploying-migrations).