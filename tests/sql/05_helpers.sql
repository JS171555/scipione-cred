do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists t;
create or replace function t.assert(p_ok boolean, p_msg text) returns void language plpgsql as
$$ begin if p_ok is not true then raise exception 'FALHA: %', p_msg; end if; end $$;
create or replace function t.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern then return; end if;
    raise exception 'FALHA: erro inesperado em [%]: % (esperado ~ %)', p_sql, sqlerrm, p_pattern;
  end;
  raise exception 'FALHA: esperava erro ~ % em [%]', p_pattern, p_sql;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;
create or replace function t.bucket_limit(p_id text) returns bigint language plpgsql security definer as
$$ declare v bigint; begin select file_size_limit into v from storage.buckets where id = p_id; return v; end $$;
