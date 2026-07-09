#!/usr/bin/env bash
# Reseed one isolated Postgres schema with a fresh copy of the Studiobook schema
# + seed data. Used by the preview-deploy workflow so concurrent preview
# environments never share mutable data (each PR maps to its own schema).
#
# Usage: DATABASE_URL=postgres://... reseed-schema.sh <schema>
#
# The canonical DDL/seed are written against the `public` schema; we rewrite the
# `public.` qualifier to the target schema so a single source stays authoritative.
set -euo pipefail

SCHEMA="${1:?usage: reseed-schema.sh <schema>}"
: "${DATABASE_URL:?DATABASE_URL is required}"

# Only allow the bounded, pre-exposed pool (bench_1..bench_99) — never touch public.
if ! [[ "$SCHEMA" =~ ^bench_[0-9]+$ ]]; then
  echo "refusing to reseed schema '$SCHEMA' (expected bench_<n>)" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$HERE/../migrations"
SEED="$HERE/../../../supabase/seed.sql"

echo "reseeding schema $SCHEMA ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "DROP SCHEMA IF EXISTS $SCHEMA CASCADE; CREATE SCHEMA $SCHEMA;"
# Apply every migration in order, not just the initial one, so the schema pool
# stays current with the migrations directory.
for migration in "$MIGRATIONS_DIR"/*.sql; do
  sed "s/public\./$SCHEMA./g" "$migration" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
done
sed "s/public\./$SCHEMA./g" "$SEED" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
# Supabase roles need access to the fresh schema (service_role bypasses RLS but
# still needs the grants). Re-granted every reseed since DROP CASCADE clears them.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
GRANT USAGE ON SCHEMA $SCHEMA TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA $SCHEMA TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA $SCHEMA TO anon, authenticated, service_role;
"
echo "schema $SCHEMA reseeded"
