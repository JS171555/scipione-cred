-- Etapa 2 · 02 · Administrador e verificação de acesso
create table public.administradores (
  id uuid primary key references auth.users (id) on delete restrict,
  nome text not null check (length(btrim(nome)) > 1),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
-- v1: no máximo UM administrador ativo (RN-01). Para liberar mais, remover este índice.
create unique index administradores_um_ativo_idx on public.administradores ((true)) where ativo;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.administradores a where a.id = auth.uid() and a.ativo)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.exigir_admin() returns void
language plpgsql stable as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
end $$;
revoke all on function public.exigir_admin() from public, anon;
grant execute on function public.exigir_admin() to authenticated;
