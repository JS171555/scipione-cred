-- Etapa 2 · 04 · Dívidas e pagamentos (regra: saldo = valor original − pagamentos válidos)
create table public.dividas (
  id uuid primary key default gen_random_uuid(),
  devedor_id uuid not null references public.devedores (id) on delete restrict,
  descricao text not null check (length(btrim(descricao)) > 1),
  valor_original numeric(14,2) not null check (valor_original > 0),
  data_registro date not null default public.hoje(),
  data_vencimento date,
  observacoes text,
  status text not null default 'em_aberto' check (status in ('em_aberto','quitada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.administradores (id),
  constraint dividas_vencimento_ok check (data_vencimento is null or data_vencimento >= data_registro)
);
create index dividas_devedor_idx on public.dividas (devedor_id);
create index dividas_status_idx on public.dividas (status);
create index dividas_vencimento_idx on public.dividas (data_vencimento) where status = 'em_aberto';

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  divida_id uuid not null references public.dividas (id) on delete restrict,
  valor numeric(14,2) not null check (valor > 0),
  data_pagamento date not null,
  observacao text,
  comprovante_path text,
  status text not null default 'valido' check (status in ('valido','estornado')),
  estornado_em timestamptz,
  estornado_por uuid,
  motivo_estorno text,
  chave_idempotencia uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.administradores (id),
  constraint pagamentos_chave_idempotencia_key unique (chave_idempotencia),
  constraint pagamentos_estorno_completo check (
    (status = 'valido' and estornado_em is null and estornado_por is null and motivo_estorno is null)
    or (status = 'estornado' and estornado_em is not null and motivo_estorno is not null and length(btrim(motivo_estorno)) >= 3)
  ),
  constraint pagamentos_comprovante_valido check (comprovante_path is null or left(comprovante_path, 37) = divida_id::text || '/')
);
create index pagamentos_divida_idx on public.pagamentos (divida_id);
create index pagamentos_divida_validos_idx on public.pagamentos (divida_id) where status = 'valido';
create index pagamentos_data_idx on public.pagamentos (data_pagamento);

-- Status da dívida: sempre derivado (nunca editado à mão).
create or replace function public.recalcular_status_divida(p_divida_id uuid) returns void
language plpgsql as $$
declare v_novo text;
begin
  select case when d.valor_original - coalesce((select sum(p.valor) from public.pagamentos p
                                                 where p.divida_id = d.id and p.status = 'valido'), 0) <= 0
              then 'quitada' else 'em_aberto' end
    into v_novo from public.dividas d where d.id = p_divida_id;
  update public.dividas set status = v_novo where id = p_divida_id and status is distinct from v_novo;
end $$;

-- ---------- dívidas ----------
create or replace function public.dividas_antes_insert() returns trigger
language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.devedores where id = new.devedor_id;
  if v_status is null then raise exception 'Devedor não encontrado.'; end if;
  if v_status <> 'ativo' then
    raise exception 'Devedor inativo: reative o cadastro antes de registrar uma nova dívida.';
  end if;
  if new.data_registro > public.hoje() then
    raise exception 'A data do registro não pode ser futura.';
  end if;
  new.status := 'em_aberto';
  new.descricao := btrim(new.descricao);
  new.observacoes := nullif(btrim(new.observacoes), '');
  return new;
end $$;
create trigger dividas_antes_insert before insert on public.dividas
  for each row execute function public.dividas_antes_insert();

create or replace function public.dividas_antes_update() returns trigger
language plpgsql as $$
declare v_pago numeric(14,2);
begin
  if new.devedor_id <> old.devedor_id then
    raise exception 'Não é permitido mover a dívida para outro devedor.';
  end if;
  if new.data_registro <> old.data_registro then
    raise exception 'A data de registro da dívida não pode ser alterada.';
  end if;
  select coalesce(sum(valor), 0) into v_pago
    from public.pagamentos where divida_id = new.id and status = 'valido';
  if new.valor_original < v_pago then
    raise exception 'O valor original (%) não pode ser menor que o total já pago (%).', new.valor_original, v_pago;
  end if;
  new.descricao := btrim(new.descricao);
  new.observacoes := nullif(btrim(new.observacoes), '');
  new.status := case when new.valor_original - v_pago <= 0 then 'quitada' else 'em_aberto' end;
  return new;
end $$;
create trigger dividas_antes_update before update on public.dividas
  for each row execute function public.dividas_antes_update();
create trigger dividas_updated_at before update on public.dividas
  for each row execute function public.set_updated_at();
create trigger dividas_sem_exclusao before delete on public.dividas
  for each row execute function public.bloquear_exclusao();

-- ---------- pagamentos ----------
create or replace function public.pagamentos_antes_insert() returns trigger
language plpgsql as $$
declare v_div record; v_pago numeric(14,2);
begin
  if new.status <> 'valido' then raise exception 'Todo novo pagamento deve nascer válido.'; end if;
  -- Bloqueia a dívida: serializa pagamentos concorrentes (RN-47).
  select id, valor_original, data_registro into v_div
    from public.dividas where id = new.divida_id for update;
  if not found then raise exception 'Dívida não encontrada.'; end if;
  if new.data_pagamento > public.hoje() then
    raise exception 'A data do pagamento não pode ser futura.';
  end if;
  if new.data_pagamento < v_div.data_registro then
    raise exception 'A data do pagamento não pode ser anterior ao registro da dívida.';
  end if;
  select coalesce(sum(valor), 0) into v_pago
    from public.pagamentos where divida_id = new.divida_id and status = 'valido';
  if v_pago + new.valor > v_div.valor_original then
    raise exception 'Pagamento (%) excede o saldo da dívida (%).', new.valor, v_div.valor_original - v_pago;
  end if;
  new.observacao := nullif(btrim(new.observacao), '');
  return new;
end $$;
create trigger pagamentos_antes_insert before insert on public.pagamentos
  for each row execute function public.pagamentos_antes_insert();

-- Pagamento é imutável: só pode ser estornado ou receber comprovante (se ainda não tem).
create or replace function public.pagamentos_antes_update() returns trigger
language plpgsql as $$
begin
  if old.status = 'estornado' then raise exception 'Pagamento estornado não pode ser alterado.'; end if;
  if new.id <> old.id or new.divida_id <> old.divida_id or new.valor <> old.valor
     or new.data_pagamento <> old.data_pagamento or new.chave_idempotencia <> old.chave_idempotencia
     or new.created_at <> old.created_at or new.observacao is distinct from old.observacao then
    raise exception 'Pagamentos não podem ser editados. Use o estorno para corrigir.';
  end if;
  if old.comprovante_path is not null and new.comprovante_path is distinct from old.comprovante_path then
    raise exception 'O comprovante já anexado não pode ser alterado.';
  end if;
  return new;
end $$;
create trigger pagamentos_antes_update before update on public.pagamentos
  for each row execute function public.pagamentos_antes_update();
create trigger pagamentos_sem_exclusao before delete on public.pagamentos
  for each row execute function public.bloquear_exclusao();

create or replace function public.pagamentos_depois() returns trigger
language plpgsql as $$
begin
  perform public.recalcular_status_divida(new.divida_id);
  return null;
end $$;
create trigger pagamentos_depois after insert or update of status on public.pagamentos
  for each row execute function public.pagamentos_depois();
