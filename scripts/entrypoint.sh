#!/bin/sh
set -eu
if [ "${RUN_MIGRATIONS_ON_START:-false}" = true ]; then
  pnpm db:deploy
fi
exec "$@"
