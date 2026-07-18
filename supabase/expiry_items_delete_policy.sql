alter table public.expiry_items enable row level security;

drop policy if exists "panel users can delete expiry items" on public.expiry_items;
create policy "panel users can delete expiry items"
  on public.expiry_items for delete to anon, authenticated using (true);
