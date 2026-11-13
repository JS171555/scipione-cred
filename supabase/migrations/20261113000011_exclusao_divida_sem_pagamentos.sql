-- Etapa 2 · 11 · Exclusão controlada de dívida sem pagamentos
-- Regra: histórico financeiro não é apagado. Só é possível excluir uma dívida que
-- nunca recebeu pagamento (lançamento criado por engano). A exclusão fica registrada
-- na auditoria com todos os dados anteriores, e o RPC é o único caminho de escrita:
-- `authenticated` continua sem GRANT/DELETE nas tabelas.

-- A autorização é um GUC transacional definido apenas dentro de public.excluir_divida().
-- Sem o valor igual ao nome da tabela, o comportamento segue o original.
create or replace function public.bloquear_exclusao() returns trigger
language plpgsql as $$
declare v_alvo text := nullif(current_setting('scipione.exclusao_autorizada', true), '');
begin
  if v_alvo = tg_table_name then return old; end if;
  raise exception 'Exclusão física não permitida em %. Use inativação, estorno ou correção auditada.', tg_table_name
    using errcode = '42501';
end $$;

create or replace function public.excluir_divida(p_divida_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_divida public.dividas;
  v_pagamentos integer;
begin
  perform public.exigir_admin();

  -- Trava a dívida: um pagamento concorrente espera esta transação e não entra depois.
  select * into v_divida from public.dividas where id = p_divida_id for update;
  if not found then
    raise exception 'Dívida não encontrada.';
  end if;

  select count(*) into v_pagamentos from public.pagamentos where divida_id = p_divida_id;
  if v_pagamentos > 0 then
    raise exception 'Esta dívida já tem pagamentos registrados e não pode ser apagada. Use o estorno para corrigir.';
  end if;

  insert into public.auditoria (usuario_id, operacao, entidade, entidade_id, devedor_id, dados_antes, dados_depois)
  values (auth.uid(), 'DELETE', 'dividas', v_divida.id, v_divida.devedor_id, to_jsonb(v_divida), null);

  perform set_config('scipione.exclusao_autorizada', 'dividas', true);
  delete from public.dividas where id = p_divida_id;
  perform set_config('scipione.exclusao_autorizada', '', true);
end $$;

revoke all on function public.excluir_divida(uuid) from public, anon;
grant execute on function public.excluir_divida(uuid) to authenticated;
