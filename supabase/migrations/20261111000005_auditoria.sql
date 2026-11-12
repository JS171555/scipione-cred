-- Etapa 2 · 05 · Auditoria append-only
create table public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  operacao text not null,
  entidade text not null,
  entidade_id uuid not null,
  devedor_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);
create index auditoria_devedor_idx on public.auditoria (devedor_id, created_at desc);
create index auditoria_entidade_idx on public.auditoria (entidade, entidade_id);

create or replace function public.auditar_mudanca() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_op text; v_ant jsonb; v_dep jsonb; v_devedor uuid;
begin
  if tg_op = 'INSERT' then
    v_op := 'INSERT';
    v_dep := to_jsonb(new) - 'busca';
  else
    v_ant := to_jsonb(old) - 'busca' - 'updated_at';
    v_dep := to_jsonb(new) - 'busca' - 'updated_at';
    if v_ant = v_dep then return new; end if;  -- nada relevante mudou
    v_op := 'UPDATE';
    -- Em dívidas, mudança de valor tem prioridade sobre a mudança (derivada) de status.
    if tg_table_name in ('devedores','dividas') and v_ant->>'status' is distinct from v_dep->>'status'
       and not (tg_table_name = 'dividas' and v_ant->>'valor_original' is distinct from v_dep->>'valor_original') then
      v_op := 'STATUS';
    elsif tg_table_name = 'pagamentos' and v_dep->>'status' = 'estornado' then
      v_op := 'ESTORNO';
    elsif tg_table_name = 'devedor_documentos' and v_dep->>'removido_em' is not null then
      v_op := 'REMOCAO';
    end if;
    v_dep := v_dep - 'created_at';
  end if;

  v_devedor := case tg_table_name
    when 'devedores' then (v_dep->>'id')::uuid
    when 'pagamentos' then (select d.devedor_id from public.dividas d where d.id = (v_dep->>'divida_id')::uuid)
    else (v_dep->>'devedor_id')::uuid end;

  insert into public.auditoria (usuario_id, operacao, entidade, entidade_id, devedor_id, dados_antes, dados_depois)
  values (auth.uid(), v_op, tg_table_name, (v_dep->>'id')::uuid, v_devedor, v_ant, v_dep);
  return new;
end $$;
revoke all on function public.auditar_mudanca() from public, anon;

create trigger devedores_auditoria after insert or update on public.devedores
  for each row execute function public.auditar_mudanca();
create trigger dividas_auditoria after insert or update on public.dividas
  for each row execute function public.auditar_mudanca();
create trigger pagamentos_auditoria after insert or update on public.pagamentos
  for each row execute function public.auditar_mudanca();
create trigger documentos_auditoria after insert or update on public.devedor_documentos
  for each row execute function public.auditar_mudanca();

create or replace function public.bloquear_mutacao_auditoria() returns trigger
language plpgsql as $$
begin raise exception 'A auditoria é somente de inclusão (append-only).' using errcode = '42501'; end $$;
create trigger auditoria_imutavel before update or delete on public.auditoria
  for each row execute function public.bloquear_mutacao_auditoria();
create trigger auditoria_sem_truncate before truncate on public.auditoria
  for each statement execute function public.bloquear_mutacao_auditoria();
