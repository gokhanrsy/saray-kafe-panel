create table if not exists public.supplier_debts (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null default 'Saray Börekçisi',
  invoice_date date not null,
  entry_type text not null default 'items',
  description text,
  total_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_debts_entry_type_check check (entry_type in ('items', 'bulk')),
  constraint supplier_debts_total_amount_check check (total_amount >= 0)
);

create table if not exists public.supplier_debt_items (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.supplier_debts(id) on delete cascade,
  product_name text not null,
  quantity numeric(12, 3) not null default 0,
  unit text not null default 'adet',
  unit_price numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint supplier_debt_items_quantity_check check (quantity >= 0),
  constraint supplier_debt_items_unit_price_check check (unit_price >= 0),
  constraint supplier_debt_items_total_price_check check (total_price >= 0)
);

create table if not exists public.supplier_debt_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null default 'Saray Börekçisi',
  payment_date date not null,
  amount numeric(12, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint supplier_debt_payments_amount_check check (amount > 0)
);

alter table public.supplier_debts
  add column if not exists supplier_name text not null default 'Saray Börekçisi';

alter table public.supplier_debts
  add column if not exists invoice_date date;

alter table public.supplier_debts
  add column if not exists entry_type text not null default 'items';

alter table public.supplier_debts
  add column if not exists description text;

alter table public.supplier_debts
  add column if not exists total_amount numeric(12, 2) not null default 0;

alter table public.supplier_debts
  add column if not exists created_at timestamptz not null default now();

alter table public.supplier_debts
  add column if not exists updated_at timestamptz not null default now();

create index if not exists supplier_debts_invoice_date_idx
  on public.supplier_debts (invoice_date desc, created_at desc);

create index if not exists supplier_debt_items_debt_id_idx
  on public.supplier_debt_items (debt_id);

create index if not exists supplier_debt_payments_payment_date_idx
  on public.supplier_debt_payments (payment_date desc, created_at desc);

alter table public.supplier_debts enable row level security;
alter table public.supplier_debt_items enable row level security;
alter table public.supplier_debt_payments enable row level security;

drop policy if exists "panel users can read supplier debts" on public.supplier_debts;
create policy "panel users can read supplier debts"
  on public.supplier_debts for select to anon, authenticated using (true);

drop policy if exists "panel users can insert supplier debts" on public.supplier_debts;
create policy "panel users can insert supplier debts"
  on public.supplier_debts for insert to anon, authenticated with check (true);

drop policy if exists "panel users can update supplier debts" on public.supplier_debts;
create policy "panel users can update supplier debts"
  on public.supplier_debts for update to anon, authenticated using (true) with check (true);

drop policy if exists "panel users can delete supplier debts" on public.supplier_debts;
create policy "panel users can delete supplier debts"
  on public.supplier_debts for delete to anon, authenticated using (true);

drop policy if exists "panel users can read supplier debt items" on public.supplier_debt_items;
create policy "panel users can read supplier debt items"
  on public.supplier_debt_items for select to anon, authenticated using (true);

drop policy if exists "panel users can insert supplier debt items" on public.supplier_debt_items;
create policy "panel users can insert supplier debt items"
  on public.supplier_debt_items for insert to anon, authenticated with check (true);

drop policy if exists "panel users can update supplier debt items" on public.supplier_debt_items;
create policy "panel users can update supplier debt items"
  on public.supplier_debt_items for update to anon, authenticated using (true) with check (true);

drop policy if exists "panel users can delete supplier debt items" on public.supplier_debt_items;
create policy "panel users can delete supplier debt items"
  on public.supplier_debt_items for delete to anon, authenticated using (true);

drop policy if exists "panel users can read supplier debt payments" on public.supplier_debt_payments;
create policy "panel users can read supplier debt payments"
  on public.supplier_debt_payments for select to anon, authenticated using (true);

drop policy if exists "panel users can insert supplier debt payments" on public.supplier_debt_payments;
create policy "panel users can insert supplier debt payments"
  on public.supplier_debt_payments for insert to anon, authenticated with check (true);

drop policy if exists "panel users can update supplier debt payments" on public.supplier_debt_payments;
create policy "panel users can update supplier debt payments"
  on public.supplier_debt_payments for update to anon, authenticated using (true) with check (true);

drop policy if exists "panel users can delete supplier debt payments" on public.supplier_debt_payments;
create policy "panel users can delete supplier debt payments"
  on public.supplier_debt_payments for delete to anon, authenticated using (true);
