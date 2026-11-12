-- Etapa 2 · 07 · RLS e permissões (anon sem acesso; só administrador via is_admin())
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.devedores, public.devedor_documentos, public.dividas, public.pagamentos to authenticated;
grant select on public.auditoria, public.administradores to authenticated;
grant select on public.vw_dividas_saldo, public.vw_devedores_resumo, public.vw_dashboard to authenticated;

alter table public.administradores enable row level security;
alter table public.devedores enable row level security;
alter table public.devedor_documentos enable row level security;
alter table public.dividas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.auditoria enable row level security;

-- Cada administrador enxerga apenas o próprio registro.
create policy administradores_select_proprio on public.administradores
  for select to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['devedores','devedor_documentos','dividas','pagamentos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_update', t);
  end loop;
end $$;
-- Sem política/grant de DELETE em nenhuma tabela (e triggers bloqueiam mesmo para o dono).

create policy auditoria_admin_select on public.auditoria
  for select to authenticated using (public.is_admin());
