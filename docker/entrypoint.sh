#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
SEED_DATA_DIR="${SEED_DATA_DIR:-/app/seed-data}"

mkdir -p "$DATA_DIR"

if [ -d "$SEED_DATA_DIR" ] && [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  cp -R "$SEED_DATA_DIR"/. "$DATA_DIR"/
fi

exec "$@"
