#!/usr/bin/env bash
# Shared helpers for local dev scripts. Source from scripts/*.sh after setting ROOT.

require_node_modules() {
  local root="${1:?project root required}"
  if [[ ! -x "$root/node_modules/.bin/supabase" ]]; then
    echo "Dependencies are not installed."
    echo "  Run: npm install"
    echo "  Then: make setup"
    exit 1
  fi
}

resolve_supabase_cli() {
  local root="${1:?project root required}"
  if [[ -x "$root/node_modules/.bin/supabase" ]]; then
    SUPABASE=("$root/node_modules/.bin/supabase")
  elif command -v supabase >/dev/null 2>&1; then
    SUPABASE=(supabase)
  else
    echo "Supabase CLI not found."
    echo "  Run: npm install"
    exit 1
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed."
    echo "  See: https://docs.docker.com/get-docker/"
    exit 1
  fi
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  echo "Cannot connect to the Docker daemon."
  echo ""
  local real_user="${SUDO_USER:-${USER:-}}"
  if [[ -n "$real_user" ]] && id -nG "$real_user" 2>/dev/null | grep -qw docker; then
    echo "  User \"$real_user\" is in the docker group, but this shell cannot access Docker."
    echo "  Run: newgrp docker"
    echo "  Or open a new terminal after: sudo usermod -aG docker \"$real_user\""
    echo ""
  else
    echo "  - Start Docker Desktop (macOS/Windows) or the docker service (Linux)."
    echo "  - Linux: add your user to the docker group, then log out and back in:"
    echo "      sudo usermod -aG docker \"\$USER\""
    echo ""
  fi
  echo "  Verify: docker info"
  exit 1
}
