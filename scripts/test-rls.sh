#!/usr/bin/env bash
# Spins up a disposable local Postgres cluster, applies the real
# supabase/migrations/*.sql (trips/trip_members/trip_invites + RLS policies +
# accept_trip_invite), and runs the RLS suite against it.
#
#   scripts/test-rls.sh            # VJT-013 assertions (fails the build on a gap)
#   scripts/test-rls.sh --audit    # full-schema probe report across every table
#   scripts/test-rls.sh --lgpd     # VJT-017b: consent log (append-only + history)
#
# This exists because the project has no local Supabase/Docker stack
# available in this session/CI (see VIAJALY-TRIP.md, Seção 3) -- it lets us
# test the actual RLS policies instead of only reading them.
set -euo pipefail

MODE="assert"
case "${1:-}" in
  --audit) MODE="audit" ;;
  --lgpd) MODE="lgpd" ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS=(
  "$REPO_ROOT/supabase/migrations/20260723120000_viajaly_trip_initial_schema.sql"
  "$REPO_ROOT/supabase/migrations/20260725200000_vjt013_trips_select_owner_bootstrap.sql"
)
AUTH_MOCK="$REPO_ROOT/supabase/tests/fixtures/auth_mock.sql"
if [ "$MODE" = "audit" ]; then
  # VJT-020 abre SELECT público em trips/filhas para `anon`. O audit é o único
  # lugar onde essa abertura é medida em vez de argumentada (Seção 3, regra de
  # processo do VJT-013), então as duas migrations abaixo entram no replay:
  # a do wizard (traz `trips.num_criancas`, que a RPC de clonagem copia) e a
  # do próprio VJT-020.
  MIGRATIONS+=(
    "$REPO_ROOT/supabase/migrations/20260724150000_vjt003_trip_wizard.sql"
    "$REPO_ROOT/supabase/migrations/20260726120000_vjt020_template_trip_public_clone.sql"
  )
  TEST_SQL="$REPO_ROOT/supabase/tests/rls_full_schema_audit.sql"
elif [ "$MODE" = "lgpd" ]; then
  # user_lgpd_consents nasce no VJT-017 e vira log append-only no VJT-017b;
  # as duas migrations entram no replay, nesta ordem, para o teste rodar
  # contra a estrutura e as policies reais.
  MIGRATIONS+=(
    "$REPO_ROOT/supabase/migrations/20260725200000_vjt017_lgpd_nps_account_deletion.sql"
    "$REPO_ROOT/supabase/migrations/20260725220000_vjt017b_lgpd_consent_history.sql"
  )
  TEST_SQL="$REPO_ROOT/supabase/tests/rls_lgpd_consents.test.sql"
else
  TEST_SQL="$REPO_ROOT/supabase/tests/rls_trip_invites.test.sql"
fi

PG_BIN="$(pg_config --bindir 2>/dev/null || true)"
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  PG_BIN="$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  echo "ERROR: PostgreSQL server binaries (initdb/pg_ctl) not found. Install postgresql before running RLS tests." >&2
  exit 1
fi

WORKDIR="$(mktemp -d /tmp/vjt013-rls.XXXXXX)"
PGDATA="$WORKDIR/data"
SOCKDIR="$WORKDIR/sock"
PGPORT=5477
LOGFILE="$WORKDIR/postgres.log"

# initdb/postgres refuse to run as root; delegate to the `postgres` OS user
# when present (true on Ubuntu with postgresql installed), run directly otherwise.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  AS_PG() { su -s /bin/bash postgres -c "$*"; }
else
  AS_PG() { bash -c "$*"; }
fi

cleanup() {
  if [ -f "$PGDATA/postmaster.pid" ]; then
    AS_PG "'$PG_BIN/pg_ctl' -D '$PGDATA' -m immediate stop" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

mkdir -p "$SOCKDIR"
chmod 777 "$WORKDIR" "$SOCKDIR"
AS_PG "mkdir -p '$PGDATA' && '$PG_BIN/initdb' -D '$PGDATA' --username=postgres --auth=trust >'$WORKDIR/initdb.log' 2>&1"

AS_PG "'$PG_BIN/pg_ctl' -D '$PGDATA' -l '$LOGFILE' -o \"-p $PGPORT -c listen_addresses='' -c unix_socket_directories='$SOCKDIR'\" -w start"

PSQL() {
  AS_PG "'$PG_BIN/psql' -v ON_ERROR_STOP=1 -h '$SOCKDIR' -p $PGPORT -U postgres -d postgres $*"
}

echo "--- applying auth mock + real trip schema migrations ---"
MIGRATION_ARGS=()
for m in "${MIGRATIONS[@]}"; do
  MIGRATION_ARGS+=(-f "'$m'")
done
PSQL -f "'$AUTH_MOCK'" "${MIGRATION_ARGS[@]}"

if [ "$MODE" = "audit" ]; then
  echo "--- running full-schema RLS audit ---"
  PSQL -f "'$TEST_SQL'"
  echo "test-rls.sh --audit: report above (see the 'veredito' column)"
elif [ "$MODE" = "lgpd" ]; then
  echo "--- running LGPD consent-log assertions ---"
  PSQL -f "'$TEST_SQL'"
  echo "test-rls.sh --lgpd: PASS"
else
  echo "--- running RLS assertions ---"
  PSQL -f "'$TEST_SQL'"
  echo "test-rls.sh: PASS"
fi
