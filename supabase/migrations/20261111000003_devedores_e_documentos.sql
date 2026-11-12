-- Etapa 2 · 03 · Devedores e documentos
create table public.devedores (
  id uuid primary key default gen_random_uuid(),
  tipo_pessoa text not null check (tipo_pessoa in ('PF','PJ')),
  nome_razao_social text not null check (length(btrim(nome_razao_social)) > 1),
  cpf_cnpj text,
  rg text,
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,11}$'),
  celular text check (celular is null or celular ~ '^[0-9]{10,11}$'),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text, numero text, complemento text, bairro text, cidade text,
  uf char(2) check (uf is null or uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  foto_path text,
  busca text generated always as (
    lower(public.f_unaccent(coalesce(nome_razao_social, ''))) || ' ' ||
    coalesce(cpf_cnpj, '') || ' ' ||
    regexp_replace(lower(coalesce(rg, '')), '[^a-z0-9]', '', 'g') || ' ' ||
    coalesce(telefone, '') || ' ' || coalesce(celular, '')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.administradores (id),
  constraint devedores_cpf_cnpj_valido check (cpf_cnpj is null or public.valida_cpf_cnpj(cpf_cnpj, tipo_pessoa)),
  constraint devedores_foto_path_valido check (foto_path is null or left(foto_path, 37) = id::text || '/')
);
-- Unicidade apenas quando informado (D-02: obrigatoriedade ainda pendente).
create unique index devedores_cpf_cnpj_key on public.devedores (cpf_cnpj) where cpf_cnpj is not null;
create index devedores_status_idx on public.devedores (status);
create index devedores_created_at_idx on public.devedores (created_at desc);
create index devedores_nome_idx on public.devedores (lower(nome_razao_social));
create index devedores_busca_trgm_idx on public.devedores using gin (busca extensions.gin_trgm_ops);

create or replace function public.normalizar_devedor() returns trigger
language plpgsql as $$
begin
  new.nome_razao_social := regexp_replace(btrim(new.nome_razao_social), '\s+', ' ', 'g');
  new.cpf_cnpj := nullif(regexp_replace(coalesce(new.cpf_cnpj, ''), '\D', '', 'g'), '');
  new.telefone := nullif(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g'), '');
  new.celular  := nullif(regexp_replace(coalesce(new.celular, ''), '\D', '', 'g'), '');
  new.cep      := nullif(regexp_replace(coalesce(new.cep, ''), '\D', '', 'g'), '');
  new.rg := nullif(btrim(new.rg), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.logradouro := nullif(btrim(new.logradouro), '');
  new.numero := nullif(btrim(new.numero), '');
  new.complemento := nullif(btrim(new.complemento), '');
  new.bairro := nullif(btrim(new.bairro), '');
  new.cidade := nullif(btrim(new.cidade), '');
  new.uf := nullif(upper(btrim(new.uf::text)), '');
  new.observacoes := nullif(btrim(new.observacoes), '');
  return new;
end $$;

create trigger devedores_normalizar before insert or update on public.devedores
  for each row execute function public.normalizar_devedor();
create trigger devedores_updated_at before update on public.devedores
  for each row execute function public.set_updated_at();
create trigger devedores_sem_exclusao before delete on public.devedores
  for each row execute function public.bloquear_exclusao();

create table public.devedor_documentos (
  id uuid primary key default gen_random_uuid(),
  devedor_id uuid not null references public.devedores (id) on delete restrict,
  tipo text not null check (tipo in ('identificacao','comprovante_endereco','outro')),
  nome_original text not null check (length(btrim(nome_original)) > 0),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/avif','image/webp','application/pdf')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.administradores (id),
  removido_em timestamptz,
  removido_por uuid,
  constraint devedor_documentos_path_valido check (left(storage_path, 37) = devedor_id::text || '/')
);
create index devedor_documentos_devedor_idx on public.devedor_documentos (devedor_id) where removido_em is null;

-- Documento só pode mudar para "removido" (soft delete); demais campos são imutáveis.
create or replace function public.proteger_documento() returns trigger
language plpgsql as $$
begin
  if old.removido_em is not null then
    raise exception 'Documento já removido não pode ser alterado.';
  end if;
  if (to_jsonb(new) - 'removido_em' - 'removido_por') <> (to_jsonb(old) - 'removido_em' - 'removido_por') then
    raise exception 'Documentos só podem ser removidos, não editados.';
  end if;
  if new.removido_em is not null then new.removido_por := auth.uid(); end if;
  return new;
end $$;
create trigger documentos_proteger before update on public.devedor_documentos
  for each row execute function public.proteger_documento();
create trigger documentos_sem_exclusao before delete on public.devedor_documentos
  for each row execute function public.bloquear_exclusao();
