#!/usr/bin/env bash
# Testes de integração dos serviços (supabase-js) contra PostgREST + PostgreSQL local com as migrations reais.
# Requer: PostgreSQL 15+, binário do PostgREST em $POSTGREST_BIN. Armazenamento (Storage) é simulado em memória.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=scipione_it; SEGREDO="segredo-de-teste-com-mais-de-32-caracteres!!"
as_pg() { if [ -n "${TEST_PG_RUN_AS:-}" ]; then su postgres -c "$1"; else bash -c "$1"; fi; }
as_pg "dropdb --if-exists $DB && createdb $DB"
for f in tests/sql/05_helpers.sql tests/sql/00_stub_supabase.sql supabase/migrations/*.sql; do as_pg "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f $PWD/$f" >/dev/null; done
as_pg "psql -X -q -v ON_ERROR_STOP=1 -d $DB" <<SQL
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001','admin@teste.local'), ('b0000000-0000-0000-0000-000000000002','outro@teste.local');
insert into public.administradores (id, nome) values ('a0000000-0000-0000-0000-000000000001','Administrador Teste');
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'pw'; end if;
end \$\$;
grant anon, authenticated to authenticator;
SQL
cat > /tmp/pgrst.conf <<CONF
db-uri = "postgres://authenticator:pw@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SEGREDO"
server-port = 3000
CONF
"${POSTGREST_BIN:-postgrest}" /tmp/pgrst.conf > /tmp/pgrst.log 2>&1 & PG_PID=$!
node tests/integration/proxy.mjs & PX_PID=$!
trap 'kill $PG_PID $PX_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:3000/ && break; sleep 0.5; done
IT_URL=http://127.0.0.1:3100 IT_JWT_SECRET="$SEGREDO" npx vitest run --config vitest.integration.config.js
