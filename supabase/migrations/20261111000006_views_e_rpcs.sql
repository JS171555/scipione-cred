-- Etapa 2 · 06 · Views de totais e RPCs financeiras
create view public.vw_dividas_saldo with (security_invoker = true) as
select d.*,
       coalesce(p.total_pago, 0)::numeric(14,2) as total_pago,
       (d.valor_original - coalesce(p.total_pago, 0))::numeric(14,2) as saldo
from public.dividas d
left join (select divida_id, sum(valor) as total_pago
             from public.pagamentos where status = 'valido' group by divida_id) p on p.divida_id = d.id;

create view public.vw_devedores_resumo with (security_invoker = true) as
select dv.*,
       coalesce(r.total_registrado, 0)::numeric(14,2) as total_registrado,
       coalesce(r.total_pago, 0)::numeric(14,2) as total_pago,
       coalesce(r.total_em_aberto, 0)::numeric(14,2) as total_em_aberto,
       coalesce(r.qtd_dividas_abertas, 0)::int as qtd_dividas_abertas,
       coalesce(r.qtd_dividas_quitadas, 0)::int as qtd_dividas_quitadas
from public.devedores dv
left join (select devedor_id,
                  sum(valor_original) as total_registrado,
                  sum(total_pago) as total_pago,
                  sum(saldo) as total_em_aberto,
                  count(*) filter (where status = 'em_aberto') as qtd_dividas_abertas,
                  count(*) filter (where status = 'quitada') as qtd_dividas_quitadas
             from public.vw_dividas_saldo group by devedor_id) r on r.devedor_id = dv.id;

create view public.vw_dashboard with (security_invoker = true) as
select (select count(*) from public.devedores)::int as total_devedores,
       (select count(*) from public.devedores where status = 'ativo')::int as devedores_ativos,
       (select count(*) from public.devedores where status = 'inativo')::int as devedores_inativos,
       (select count(*) from public.dividas where status = 'em_aberto')::int as dividas_em_aberto,
       (select count(*) from public.dividas where status = 'quitada')::int as dividas_quitadas,
       (select coalesce(sum(saldo), 0) from public.vw_dividas_saldo where status = 'em_aberto')::numeric(14,2) as valor_total_em_aberto;

-- ---------- RPCs (SECURITY INVOKER: respeitam RLS e triggers) ----------
create or replace function public.registrar_divida(
  p_devedor_id uuid, p_descricao text, p_valor numeric,
  p_data_registro date default null, p_vencimento date default null, p_observacoes text default null
) returns public.dividas language plpgsql as $$
declare r public.dividas;
begin
  perform public.exigir_admin();
  insert into public.dividas (devedor_id, descricao, valor_original, data_registro, data_vencimento, observacoes)
  values (p_devedor_id, p_descricao, p_valor, coalesce(p_data_registro, public.hoje()), p_vencimento, p_observacoes)
  returning * into r;
  return r;
end $$;

create or replace function public.alterar_valor_divida(p_divida_id uuid, p_valor numeric)
returns public.dividas language plpgsql as $$
declare r public.dividas;
begin
  perform public.exigir_admin();
  update public.dividas set valor_original = p_valor where id = p_divida_id returning * into r;
  if not found then raise exception 'Dívida não encontrada.'; end if;
  return r;
end $$;

create or replace function public.registrar_pagamento(
  p_divida_id uuid, p_valor numeric, p_data date, p_observacao text,
  p_comprovante_path text, p_chave uuid
) returns public.pagamentos language plpgsql as $$
declare r public.pagamentos;
begin
  perform public.exigir_admin();
  if p_chave is null then raise exception 'Chave de idempotência obrigatória.'; end if;
  perform 1 from public.dividas where id = p_divida_id for update;   -- serializa por dívida
  if not found then raise exception 'Dívida não encontrada.'; end if;
  select * into r from public.pagamentos where chave_idempotencia = p_chave;
  if found then
    if r.divida_id <> p_divida_id then raise exception 'Chave de idempotência já utilizada em outra operação.'; end if;
    return r;  -- reenvio do mesmo pagamento: devolve o já registrado
  end if;
  insert into public.pagamentos (divida_id, valor, data_pagamento, observacao, comprovante_path, chave_idempotencia)
  values (p_divida_id, p_valor, coalesce(p_data, public.hoje()), p_observacao, p_comprovante_path, p_chave)
  returning * into r;
  return r;
end $$;

create or replace function public.estornar_pagamento(p_pagamento_id uuid, p_motivo text)
returns public.pagamentos language plpgsql as $$
declare v_div uuid; r public.pagamentos;
begin
  perform public.exigir_admin();
  if p_motivo is null or length(btrim(p_motivo)) < 3 then
    raise exception 'Informe o motivo do estorno (mínimo 3 caracteres).';
  end if;
  select divida_id into v_div from public.pagamentos where id = p_pagamento_id;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  perform 1 from public.dividas where id = v_div for update;
  update public.pagamentos
     set status = 'estornado', estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_pagamento_id and status = 'valido'
  returning * into r;
  if not found then raise exception 'Pagamento já estornado.'; end if;
  return r;
end $$;

-- Inativar com dívidas em aberto exige confirmação explícita (D-07).
create or replace function public.alterar_status_devedor(p_devedor_id uuid, p_status text, p_confirmar boolean default false)
returns jsonb language plpgsql as $$
declare v_atual text; v_qtd int; v_val numeric(14,2);
begin
  perform public.exigir_admin();
  if p_status not in ('ativo','inativo') then raise exception 'Status inválido.'; end if;
  select status into v_atual from public.devedores where id = p_devedor_id for update;
  if not found then raise exception 'Devedor não encontrado.'; end if;
  if v_atual = p_status then
    return jsonb_build_object('alterado', false, 'requer_confirmacao', false, 'status', v_atual);
  end if;
  if p_status = 'inativo' then
    select count(*), coalesce(sum(saldo), 0) into v_qtd, v_val
      from public.vw_dividas_saldo where devedor_id = p_devedor_id and status = 'em_aberto';
    if v_qtd > 0 and not p_confirmar then
      return jsonb_build_object('alterado', false, 'requer_confirmacao', true,
                                'qtd_dividas_abertas', v_qtd, 'valor_em_aberto', v_val);
    end if;
  end if;
  update public.devedores set status = p_status where id = p_devedor_id;
  return jsonb_build_object('alterado', true, 'requer_confirmacao', false, 'status', p_status);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'registrar_divida(uuid,text,numeric,date,date,text)',
    'alterar_valor_divida(uuid,numeric)',
    'registrar_pagamento(uuid,numeric,date,text,text,uuid)',
    'estornar_pagamento(uuid,text)',
    'alterar_status_devedor(uuid,text,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
