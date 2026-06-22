# Local development: Supabase (Docker via CLI) + optional Compose services.
# Requires: Docker, Node 20+, npm

ifneq ($(wildcard node_modules/.bin/supabase),)
SUPABASE := ./node_modules/.bin/supabase
else
SUPABASE := npx --no-install supabase
endif
COMPOSE ?= docker compose

.PHONY: help install up down status sync-env db-reset db-migrate dev infra docker-up docker-down setup repair

help:
	@echo "Blabber local development"
	@echo ""
	@echo "  make setup      First-time: npm install + start infra + sync .env.local"
	@echo "  make install    Install npm dependencies (runs automatically in setup)"
	@echo "  make up         Start Supabase (+ optional docker dev profile)"
	@echo "  make down       Stop Supabase and docker dev services"
	@echo "  make dev        up + sync-env + next dev"
	@echo "  make db-reset   Reset local DB (all migrations + seed.sql)"
	@echo "  make sync-env   Write Supabase keys into .env.local"
	@echo "  make status     Show Supabase local URLs and keys"

install:
	@if [ ! -x node_modules/.bin/supabase ]; then npm install; else echo "Dependencies already installed."; fi

setup: install up
	@echo ""
	@echo "Setup complete. Add Stripe/Resend/etc. test keys to .env.local if you need those features."

up:
	@./scripts/dev-up.sh

down:
	@./scripts/dev-down.sh

repair:
	@./scripts/infra-repair.sh

status:
	@$(SUPABASE) status

sync-env:
	@./scripts/sync-local-env.sh

db-reset:
	@$(SUPABASE) db reset

db-migrate:
	@$(SUPABASE) migration list

docker-up:
	@$(COMPOSE) --profile dev up -d

docker-down:
	@$(COMPOSE) --profile dev down

infra: up

dev: up sync-env
	npm run dev --https
