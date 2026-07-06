alter table public.products enable row level security;

drop policy if exists "panel users can delete products" on public.products;
create policy "panel users can delete products"
  on public.products for delete to anon, authenticated using (true);
