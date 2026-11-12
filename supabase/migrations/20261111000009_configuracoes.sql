-- Etapa 2 · 09 · Configurações (limites de upload) sincronizadas com os buckets
create table public.configuracoes (
  chave text primary key check (chave in ('upload.foto_max_bytes','upload.documento_max_bytes','upload.comprovante_max_bytes')),
  valor jsonb not null check (
    case when jsonb_typeof(valor) = 'number'
         then (valor #>> '{}')::numeric between 1024 and 104857600 and (valor #>> '{}')::numeric = floor((valor #>> '{}')::numeric)
         else false end),
  updated_at timestamptz not null default now()
);
create trigger configuracoes_updated_at before update on public.configuracoes
  for each row execute function public.set_updated_at();

create or replace function public.sincronizar_limites_storage() returns trigger
language plpgsql security definer set search_path = public, storage as $$
begin
  update storage.buckets
     set file_size_limit = (new.valor #>> '{}')::bigint
   where id = case new.chave
                when 'upload.foto_max_bytes' then 'fotos-devedores'
                when 'upload.documento_max_bytes' then 'documentos-devedores'
                else 'comprovantes-pagamentos' end;
  return new;
end $$;
revoke all on function public.sincronizar_limites_storage() from public, anon;
create trigger configuracoes_sync_storage after insert or update of valor on public.configuracoes
  for each row execute function public.sincronizar_limites_storage();

alter table public.configuracoes enable row level security;
revoke all on public.configuracoes from anon, authenticated;
grant select, update on public.configuracoes to authenticated;
create policy configuracoes_admin_select on public.configuracoes for select to authenticated using (public.is_admin());
create policy configuracoes_admin_update on public.configuracoes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Valores provisórios (D-06 pendente): foto 5 MB, documento 10 MB, comprovante 10 MB.
insert into public.configuracoes (chave, valor) values
  ('upload.foto_max_bytes', '5242880'),
  ('upload.documento_max_bytes', '10485760'),
  ('upload.comprovante_max_bytes', '10485760');
