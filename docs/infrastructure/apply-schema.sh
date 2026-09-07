#!/bin/sh
# Applies docs/database/schema-base.sql — a real pg_dump --schema-only of
# the production `public` schema (see docs/database/README.md) — straight
# from the repo's own file, no copies. Runs once per fresh `db_data`
# volume: if public.branches already exists it assumes the schema is in
# place and skips, so re-running `docker compose up` on an existing volume
# is a no-op.
#
# Then seeds the default superadmin (idempotent via ON CONFLICT — safe to
# run on every startup, including on an already-initialized volume).
set -e

DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres"

ALREADY_INIT=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.branches') IS NOT NULL")
if [ "$ALREADY_INIT" = "t" ]; then
  echo "[db-init] Schema already present (public.branches exists) — skipping schema."
else
  echo "[db-init] Applying schema-base.sql (real production schema export)..."
  # `public` already exists on any fresh Postgres database — pg_dump still
  # emits `CREATE SCHEMA public;` unconditionally, which errors on a target
  # that didn't drop it first. Filtered out here instead of editing
  # schema-base.sql, so that file stays a faithful, unmodified pg_dump.
  grep -v '^CREATE SCHEMA public;$' /sql/000-base/schema-base.sql \
    | psql "$DB_URL" -v ON_ERROR_STOP=1
fi

echo "[db-init] Seeding default superadmin (superadmin@pippo.dev)..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f /sql/002-seed/03_seed_superadmin.sql

# supabase/postgres 17.x no propaga POSTGRES_PASSWORD a los roles internos
# (authenticator, supabase_auth_admin, supabase_storage_admin) como sí hacía
# la 15.x — quedan sin password y auth/rest/storage no pueden conectarse.
# Se las fija acá para que coincidan con lo que ya asume docker-compose.yml
# (todas usan "postgres"). ALTER ROLE es idempotente, corre en cada arranque.
# Nota: "postgres" en esta imagen NO es superuser (rolsuper=false) — son
# roles reservados que solo "supabase_admin" (el superuser real) puede tocar.
echo "[db-init] Syncing internal Supabase role passwords..."
SUPERUSER_DB_URL="postgresql://supabase_admin:${POSTGRES_PASSWORD}@db:5432/postgres"
psql "$SUPERUSER_DB_URL" -v ON_ERROR_STOP=1 <<-SQL
  ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
SQL

echo "[db-init] Done."
