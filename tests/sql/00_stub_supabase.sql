-- Simula o mínimo da plataforma Supabase para testar as migrations em Postgres puro.
create schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                   (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, extensions, storage, t to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
