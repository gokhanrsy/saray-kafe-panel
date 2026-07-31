alter table public.products
  add column if not exists location text null;

create index if not exists products_location_idx
  on public.products (location);
