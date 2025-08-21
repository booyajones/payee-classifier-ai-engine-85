#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dupe_candidates;"
