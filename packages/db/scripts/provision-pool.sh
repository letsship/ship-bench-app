#!/usr/bin/env bash
# ONE-TIME setup of the preview-isolation schema pool. Creates bench_1..bench_N,
# exposes them to PostgREST (so supabase-js `db: { schema }` can reach them), and
# reseeds each. Re-runnable. Preview deploys pick a schema by PR number and
# reseed just that one via reseed-schema.sh.
#
# Usage: DATABASE_URL=postgres://... provision-pool.sh [pool_size]   (default 12)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
POOL="${1:-12}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build the exposed-schema list (public + graphql_public are Supabase defaults).
LIST="public, graphql_public"
for i in $(seq 1 "$POOL"); do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE SCHEMA IF NOT EXISTS bench_$i;"
  LIST="$LIST, bench_$i"
done

echo "exposing schemas to PostgREST: $LIST"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
ALTER ROLE authenticator SET pgrst.db_schemas = '$LIST';
NOTIFY pgrst, 'reload config';
"

for i in $(seq 1 "$POOL"); do
  DATABASE_URL="$DATABASE_URL" bash "$HERE/reseed-schema.sh" "bench_$i"
done
echo "pool of $POOL schemas provisioned + exposed"
