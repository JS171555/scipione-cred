-- Etapa 2 · 01 · Extensões e funções utilitárias
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Data "de hoje" no fuso de Brasília (o servidor roda em UTC).
create or replace function public.hoje() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Wrapper imutável de unaccent (necessário para coluna gerada e índice).
create or replace function public.f_unaccent(p text) returns text
language sql immutable parallel safe
set search_path = extensions, public
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p) $$;

-- Impede exclusão física de registros que compõem o histórico.
create or replace function public.bloquear_exclusao() returns trigger
language plpgsql as $$
begin
  raise exception 'Exclusão física não permitida em %. Use inativação, estorno ou correção auditada.', tg_table_name
    using errcode = '42501';
end $$;

-- Validação de CPF (PF) e CNPJ (PJ) com dígitos verificadores. Recebe só dígitos.
create or replace function public.valida_cpf_cnpj(p_doc text, p_tipo text) returns boolean
language plpgsql immutable parallel safe as $$
declare
  d int[]; soma int; resto int; i int;
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if p_doc is null or p_doc !~ '^[0-9]+$' then return false; end if;
  if p_tipo = 'PF' then
    if length(p_doc) <> 11 or p_doc ~ '^(.)\1{10}$' then return false; end if;
    for i in 1..11 loop d[i] := substr(p_doc, i, 1)::int; end loop;
    soma := 0; for i in 1..9 loop soma := soma + d[i] * (11 - i); end loop;
    resto := (soma * 10) % 11; if resto = 10 then resto := 0; end if;
    if resto <> d[10] then return false; end if;
    soma := 0; for i in 1..10 loop soma := soma + d[i] * (12 - i); end loop;
    resto := (soma * 10) % 11; if resto = 10 then resto := 0; end if;
    return resto = d[11];
  elsif p_tipo = 'PJ' then
    if length(p_doc) <> 14 or p_doc ~ '^(.)\1{13}$' then return false; end if;
    for i in 1..14 loop d[i] := substr(p_doc, i, 1)::int; end loop;
    soma := 0; for i in 1..12 loop soma := soma + d[i] * pesos1[i]; end loop;
    resto := soma % 11; resto := case when resto < 2 then 0 else 11 - resto end;
    if resto <> d[13] then return false; end if;
    soma := 0; for i in 1..13 loop soma := soma + d[i] * pesos2[i]; end loop;
    resto := soma % 11; resto := case when resto < 2 then 0 else 11 - resto end;
    return resto = d[14];
  end if;
  return false;
end $$;
