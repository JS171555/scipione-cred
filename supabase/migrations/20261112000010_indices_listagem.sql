-- Etapa 4 · 10 · Índices para listagem paginada, ordenação por nome/data e agregação por devedor (aditiva).
create index if not exists devedores_nome_ord_idx on public.devedores (nome_razao_social, id);
create index if not exists devedores_created_ord_idx on public.devedores (created_at, id);
create index if not exists dividas_devedor_status_idx on public.dividas (devedor_id, status);
