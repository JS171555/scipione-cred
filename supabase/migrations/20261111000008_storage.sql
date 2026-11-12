-- Etapa 2 · 08 · Buckets privados e políticas de acesso
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos-devedores',         'fotos-devedores',         false,  5242880, array['image/png','image/jpeg','image/avif']),
  ('documentos-devedores',    'documentos-devedores',    false, 10485760, array['image/png','image/jpeg','image/avif','image/webp','application/pdf']),
  ('comprovantes-pagamentos', 'comprovantes-pagamentos', false, 10485760, array['image/png','image/jpeg','image/avif','image/webp','application/pdf'])
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types;

-- Fotos: leitura, envio, troca e remoção da foto antiga.
create policy sc_fotos_admin on storage.objects for all to authenticated
  using (bucket_id = 'fotos-devedores' and public.is_admin())
  with check (bucket_id = 'fotos-devedores' and public.is_admin());

-- Documentos e comprovantes: leitura e envio apenas (sem apagar/sobrescrever; remoção é lógica no banco).
create policy sc_documentos_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos-devedores' and public.is_admin());
create policy sc_documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-devedores' and public.is_admin());
create policy sc_comprovantes_select on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes-pagamentos' and public.is_admin());
create policy sc_comprovantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes-pagamentos' and public.is_admin());
