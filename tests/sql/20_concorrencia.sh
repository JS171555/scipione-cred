#!/usr/bin/env bash
# Dois pagamentos simultâneos de 70 sobre uma dívida de 100: apenas um pode passar.
DB="${1:-scipione_test}"
Q() { su postgres -c "psql -X -q -t -A -d $DB -c \"$1\""; }
DIV=$(Q "select id from public.dividas where descricao='Dívida concorrência'")
SET="select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);"
call() { # $1 = chave
  su postgres -c "psql -X -q -t -A -d $DB" <<SQL 2>&1
begin; set local role authenticated; $SET
select public.registrar_pagamento('$DIV', 70, null, null, null, '$1');
commit;
SQL
}
call 'c0000000-0000-0000-0000-000000000001' > /tmp/conc1.out &
call 'c0000000-0000-0000-0000-000000000002' > /tmp/conc2.out &
wait
OK=$(cat /tmp/conc1.out /tmp/conc2.out | grep -c "excede o saldo" || true)
N=$(Q "select count(*) from public.pagamentos where divida_id='$DIV' and status='valido'")
SALDO=$(Q "select saldo from public.vw_dividas_saldo where id='$DIV'")
echo "pagamentos válidos: $N, saldo: $SALDO, rejeições por saldo: $OK"
[ "$N" = "1" ] && [ "$OK" = "1" ] && [ "$SALDO" = "30.00" ] || { echo "FALHA: concorrência"; cat /tmp/conc1.out /tmp/conc2.out; exit 1; }
