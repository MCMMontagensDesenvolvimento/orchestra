#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
TARGET_ENV=""
CONFIRMATION=""
DRY_RUN=false
RUNNER=host

usage() {
  cat <<'EOF'
Usage: scripts/prod-migrate-deploy.sh [OPTIONS]

Apply only the existing, versioned Prisma migrations through `prisma migrate deploy`.

Options:
  --environment NAME       Required target: homologation, staging, or production.
  --confirm deploy-NAME    Required exact non-interactive confirmation.
  --compose                Run the opt-in Compose migration job on the production network.
  --dry-run                Validate arguments and print the safe plan without using DATABASE_URL.
  --help                   Print this help.

Examples:
  scripts/prod-migrate-deploy.sh --dry-run --environment homologation
  scripts/prod-migrate-deploy.sh --environment production --confirm deploy-production
  scripts/prod-migrate-deploy.sh --compose --environment production --confirm deploy-production

The live command requires DATABASE_URL in the process environment, never prints it, never creates
a migration, and never runs prisma migrate dev. Back up and validate restore before this command.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --environment)
      [ "$#" -ge 2 ] || fail '--environment requires a value'
      TARGET_ENV="$2"
      shift 2
      ;;
    --confirm)
      [ "$#" -ge 2 ] || fail '--confirm requires a value'
      CONFIRMATION="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --compose)
      RUNNER=compose
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "unknown option: $1"
      ;;
  esac
done

case "$TARGET_ENV" in
  homologation|staging|production) ;;
  '')
    if [ "$DRY_RUN" = false ]; then
      fail '--environment is required'
    fi
    ;;
  *) fail '--environment must be homologation, staging, or production' ;;
esac

[ -d "$BACKEND_DIR/prisma/migrations" ] || fail 'versioned Prisma migrations directory is missing'
[ -f "$BACKEND_DIR/package.json" ] || fail 'backend/package.json is missing'

if [ "$DRY_RUN" = true ]; then
  printf 'Production migration dry-run\n'
  printf 'Target: %s\n' "${TARGET_ENV:-<not-selected>}"
  printf 'Runner: %s\n' "$RUNNER"
  printf 'Plan: verify backup/restore evidence, run prisma migrate deploy, then prisma migrate status.\n'
  printf 'No DATABASE_URL was read, no database was contacted, and no migration was applied.\n'
  exit 0
fi

[ "$CONFIRMATION" = "deploy-$TARGET_ENV" ] \
  || fail "explicit confirmation required: --confirm deploy-$TARGET_ENV"
[ -n "${DATABASE_URL:-}" ] || fail 'DATABASE_URL is required in the process environment'

printf 'Applying existing Prisma migrations to %s. DATABASE_URL will not be displayed.\n' "$TARGET_ENV"
if [ "$RUNNER" = compose ]; then
  command -v docker >/dev/null 2>&1 || fail 'docker is required for the Compose runner'
  docker compose version >/dev/null 2>&1 || fail 'Docker Compose plugin is required for the Compose runner'
  [ -n "${POSTGRES_PASSWORD:-}" ] || fail 'POSTGRES_PASSWORD is required for the Compose runner'
  [ -n "${JWT_SECRET:-}" ] || fail 'JWT_SECRET is required for production Compose validation'
  docker compose -f "$ROOT_DIR/docker-compose.prod.yml" --profile operations run --rm migrate
  printf 'Validating Prisma migration status after deploy.\n'
  docker compose -f "$ROOT_DIR/docker-compose.prod.yml" --profile operations \
    run --rm migrate npm exec -- prisma migrate status
else
  command -v npm >/dev/null 2>&1 || fail 'npm is required'
  npm --prefix "$BACKEND_DIR" run prisma:migrate:deploy
  printf 'Validating Prisma migration status after deploy.\n'
  npm --prefix "$BACKEND_DIR" exec -- prisma migrate status
fi
printf 'Migration deploy completed for %s.\n' "$TARGET_ENV"
