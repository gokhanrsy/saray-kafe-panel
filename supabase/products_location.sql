alter table public.products
  add column if not exists location text null default 'Dolap';

update public.products
  set location = 'Dolap'
  where location is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_location_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_location_check
      check (location is null or location in ('Dolap', 'Depo', 'Tezgah'))
      not valid;
  end if;
end $$;

create index if not exists products_location_idx
  on public.products (location);
