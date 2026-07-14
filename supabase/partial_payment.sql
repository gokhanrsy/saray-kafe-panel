drop function if exists public.process_partial_payment(text, jsonb, text, text);

create function public.process_partial_payment(
  p_order_id text,
  p_items jsonb,
  p_table_name text,
  p_note text default null
)
returns table (
  payment_order_id text,
  paid_total numeric,
  remaining_total numeric,
  closed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_order public.orders%rowtype;
  v_payment_order public.orders%rowtype;
  v_source_item public.order_items%rowtype;
  v_selection jsonb;
  v_product_name text;
  v_base_product_name text;
  v_selected_quantity integer;
  v_remaining_quantity integer;
  v_paid_total numeric := 0;
  v_remaining_total numeric := 0;
  v_is_weighted boolean := false;
  v_product_exists boolean := false;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Ödeme için ürün seçilmedi.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) selection
    group by trim(selection ->> 'product_name')
    having count(*) > 1
  ) then
    raise exception 'Aynı ürün ödeme listesinde birden fazla kez gönderilemez.';
  end if;

  select *
    into v_source_order
  from public.orders
  where id::text = p_order_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Açık adisyon bulunamadı veya daha önce kapatıldı.';
  end if;

  -- Validate the complete selection before changing any row.
  for v_selection in
    select value from jsonb_array_elements(p_items)
  loop
    v_product_name := trim(coalesce(v_selection ->> 'product_name', ''));
    v_selected_quantity := floor(coalesce(nullif(v_selection ->> 'quantity', '')::numeric, 0));

    if v_product_name = '' or v_selected_quantity <= 0 then
      raise exception 'Geçersiz ödeme seçimi.';
    end if;

    select *
      into v_source_item
    from public.order_items
    where order_id = v_source_order.id
      and product_name = v_product_name
    for update;

    if not found then
      raise exception '% ürünü açık adisyonda bulunamadı.', v_product_name;
    end if;

    if v_selected_quantity > v_source_item.quantity then
      raise exception '% için seçilen adet kalan adetten fazla.', v_product_name;
    end if;

    v_paid_total := v_paid_total + (v_source_item.unit_price * v_selected_quantity);
  end loop;

  if v_paid_total <= 0 then
    raise exception 'Ödeme toplamı sıfır olamaz.';
  end if;

  -- Paid items become a normal completed order, so reports and revenue include them.
  insert into public.orders (
    table_name,
    total_price,
    paid,
    status,
    note
  )
  values (
    coalesce(nullif(trim(p_table_name), ''), v_source_order.table_name),
    v_paid_total,
    true,
    'completed',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_payment_order;

  for v_selection in
    select value from jsonb_array_elements(p_items)
  loop
    v_product_name := trim(v_selection ->> 'product_name');
    v_selected_quantity := floor((v_selection ->> 'quantity')::numeric);

    select *
      into v_source_item
    from public.order_items
    where order_id = v_source_order.id
      and product_name = v_product_name
    for update;

    insert into public.order_items (
      order_id,
      product_name,
      quantity,
      unit_price,
      total_price
    )
    values (
      v_payment_order.id,
      v_source_item.product_name,
      v_selected_quantity,
      v_source_item.unit_price,
      v_source_item.unit_price * v_selected_quantity
    );

    v_remaining_quantity := v_source_item.quantity - v_selected_quantity;

    if v_remaining_quantity <= 0 then
      delete from public.order_items
      where order_id = v_source_order.id
        and product_name = v_source_item.product_name;
    else
      update public.order_items
      set
        quantity = v_remaining_quantity,
        total_price = v_source_item.unit_price * v_remaining_quantity
      where order_id = v_source_order.id
        and product_name = v_source_item.product_name;
    end if;

    -- Weighted products are monetary lines and must not decrement piece stock.
    v_base_product_name := regexp_replace(
      v_source_item.product_name,
      ' - [0-9]+([.,][0-9]+)? TL$',
      ''
    );
    v_is_weighted := false;
    v_product_exists := false;

    select true, coalesce(unit_type, 'piece') = 'weighted'
      into v_product_exists, v_is_weighted
    from public.products
    where name = v_base_product_name;

    if v_product_exists and not v_is_weighted then
      update public.products
      set stock = greatest(0, coalesce(stock, 0) - v_selected_quantity)
      where name = v_base_product_name;

      insert into public.stock_movements (
        product_name,
        movement_type,
        quantity,
        note
      )
      values (
        v_base_product_name,
        'sale',
        -v_selected_quantity,
        coalesce(nullif(trim(p_table_name), ''), v_source_order.table_name) || ' kısmi ödeme'
      );
    end if;
  end loop;

  select coalesce(sum(total_price), 0)
    into v_remaining_total
  from public.order_items
  where order_id = v_source_order.id;

  if v_remaining_total <= 0 then
    delete from public.orders
    where id = v_source_order.id;
  else
    update public.orders
    set
      total_price = v_remaining_total,
      paid = false,
      status = 'pending'
    where id = v_source_order.id;
  end if;

  return query
  select
    v_payment_order.id::text,
    v_paid_total,
    v_remaining_total,
    v_remaining_total <= 0;
end;
$$;

revoke all on function public.process_partial_payment(text, jsonb, text, text) from public;
grant execute on function public.process_partial_payment(text, jsonb, text, text) to anon, authenticated;
