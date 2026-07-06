alter table public.products
  add column if not exists favorite_order integer null;

create index if not exists products_favorite_order_idx
  on public.products (favorite, favorite_order, name);
