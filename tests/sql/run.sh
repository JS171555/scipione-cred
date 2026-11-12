#!/usr/bin/env bash
# Testes SQL de integridade, regras financeiras, RLS e auditoria.
# Requer Postgres 15+ acessível. Padrão: socket local como usuário postgres.
set -euo pipefail
cd "$(dirname "$0")"
DB=scipione_test
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
if [ -n "${TEST_PG_RUN_AS:-}" ]; then RUN=(su postgres -c); else RUN=(bash -c); fi
run() { "${RUN[@]}" "$1"; }

run "dropdb --if-exists $DB && createdb $DB"
run "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f $PWD/05_helpers.sql"
run "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f $PWD/00_stub_supabase.sql"
for f in ../../supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  run "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f $(realpath "$f")"
done
echo "== testes =="
run "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f $PWD/10_testes.sql"
echo "== concorrência =="
bash "$PWD/20_concorrencia.sh" "$DB"
echo "TODOS OS TESTES SQL PASSARAM"
