-- Fotos são convertidas para WebP no navegador antes do upload (RN-20).
-- O bucket precisa aceitar o formato resultante da conversão.
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/avif', 'image/webp']
 where id = 'fotos-devedores';
