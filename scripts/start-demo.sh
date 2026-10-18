#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
cd "$project_root"

if ! command -v docker >/dev/null 2>&1; then
    fail 'Docker is required. Install Docker Desktop or Docker Engine with the Compose plugin.'
fi

if ! docker compose version >/dev/null 2>&1; then
    fail 'Docker Compose v2 is required. Install the Docker Compose plugin and try again.'
fi

compose_up_help="$(docker compose up --help 2>&1)" || fail 'Could not inspect Docker Compose options.'
if [[ "$compose_up_help" != *'--wait'* ]]; then
    fail 'This launcher requires a Docker Compose version that supports the up --wait option.'
fi

if ! docker info >/dev/null 2>&1; then
    fail 'The Docker daemon is unavailable. Start Docker Desktop or Docker Engine and try again.'
fi

if [[ -L .env && ! -e .env ]]; then
    fail '.env is a broken symbolic link. Fix it or remove the link before starting the demo.'
fi

if [[ ! -e .env ]]; then
    [[ -f .env.example ]] || fail '.env.example is missing; cannot create local configuration.'
    if (umask 077; set -C; cat .env.example > .env) 2>/dev/null; then
        printf 'Created .env from .env.example with owner-only permissions.\n'
    else
        fail 'Could not create .env; it may have appeared concurrently. Inspect it before rerunning.'
    fi
fi

[[ -f .env ]] || fail '.env exists but is not a regular file; it was left unchanged.'

printf 'Building and starting the app. The first run may take several minutes.\n'
docker compose up --build --detach --wait --wait-timeout 600

printf 'Seeding demo data if the database is empty. Existing data and account passwords are preserved.\n'
docker compose exec -T api python -m app.seed --demo --if-empty

admin_username="$(docker compose exec -T api python -c 'from app.config import settings; print(settings.initial_admin_username.strip().lower())')" \
    || fail 'Could not read the configured initial admin username from the API container.'
[[ -n "$admin_username" ]] || fail 'INITIAL_ADMIN_USERNAME is empty in the API container.'

printf '\nApp ready: http://localhost:8080\n'
printf 'Fresh demo accounts: %s, demo_mio, demo_gask, demo_police.\n' "$admin_username"
printf 'Their initial passwords are read from INITIAL_ADMIN_PASSWORD and DEMO_USER_PASSWORD in .env.\n'
printf 'An existing database keeps its current accounts and passwords.\n'
