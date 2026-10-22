#!/usr/bin/env bash
# =============================================================================
# Runs the schema + every SQL test suite against a throw-away local PostgreSQL.
# =============================================================================
# Needs PostgreSQL 15+ and `psql` on PATH.
#
#   ./supabase/tests/run-local.sh
#
#   # custom connection (user / host / port)
#   PGUSER=postgres PGHOST=localhost PGPORT=5432 ./supabase/tests/run-local.sh
#
#   # or a full URL (the database name in the URL is ignored; a scratch one is used)
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
#     ./supabase/tests/run-local.sh
#
# Windows: run it from Git Bash (`bash supabase/tests/run-local.sh`) or from an
# Ubuntu terminal if you enabled WSL. PowerShell itself cannot run .sh files.
#
# Creates and drops the database `dokan_bondhu_test`. It refuses to run if that
# name looks like a real Supabase database.
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/../.."

PSQL_BIN="${PSQL_BIN:-psql}"
TEST_DB="${TEST_DB:-dokan_bondhu_test}"

case "$TEST_DB" in
  *supabase*|*prod*|*production*) echo "Refusing to use database '$TEST_DB'."; exit 1 ;;
esac

if [ -n "${DATABASE_URL:-}" ]; then
  BASE="${DATABASE_URL%/*}"
  admin() { "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d "$BASE/postgres" "$@"; }
  scratch() { "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d "$BASE/$TEST_DB" "$@"; }
else
  admin() { "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d postgres "$@"; }
  scratch() { "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d "$TEST_DB" "$@"; }
fi

echo "==> fresh database: $TEST_DB"
admin -c "drop database if exists $TEST_DB" >/dev/null 2>&1 || true
if ! admin -c "create database $TEST_DB" >/dev/null; then
  echo "Could not create the test database. Is PostgreSQL running and are the"
  echo "credentials correct? (PGUSER / PGHOST / PGPORT / PGPASSWORD)"
  exit 1
fi

echo "==> harness"
scratch -f supabase/tests/00_harness.sql >/dev/null
scratch -f supabase/tests/01_assert.sql >/dev/null

echo "==> migrations"
for file in supabase/migrations/*.sql; do
  printf '    %-34s' "$(basename "$file")"
  if out=$(scratch -f "$file" 2>&1); then
    echo "ok"
  else
    echo "FAILED"
    echo "$out" | sed 's/^/        /'
    exit 1
  fi
done

echo "==> seed"
scratch -f supabase/seed.sql >/dev/null

echo "==> test suites"
failed=0
for file in supabase/tests/[1-9]*.sql; do
  printf '    %-34s' "$(basename "$file")"
  if out=$(SCRATCH_DB="$TEST_DB" scratch -f "$file" 2>&1); then
    echo "PASS"
  else
    echo "FAIL"
    echo "$out" | sed 's/^/        /'
    failed=1
  fi
done

admin -c "drop database if exists $TEST_DB" >/dev/null 2>&1 || true

if [ "$failed" -ne 0 ]; then
  echo "==> RESULT: FAILED"
  exit 1
fi

echo "==> RESULT: all suites passed"
