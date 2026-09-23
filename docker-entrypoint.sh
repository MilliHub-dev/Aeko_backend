#!/bin/sh
set -eu

# Applies pending Prisma migrations before the server starts, when asked.
# Off by default: a migration that fails must not put the API into a restart
# loop, and with one replica it is safer to run it deliberately
# (RUN_MIGRATIONS=1 for one deploy, or `docker compose run --rm backend
# npx prisma migrate deploy`).
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "==> prisma migrate deploy"
  npx prisma migrate deploy
fi

exec "$@"
