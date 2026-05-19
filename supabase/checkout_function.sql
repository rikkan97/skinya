-- ============================================================
-- SKINYA · CHECKOUT RPC FUNCTION
-- Τρέξε στο Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Δημιουργεί order + order_items atomically σε ένα call.
-- ============================================================

create or replace function public.create_order(
  p_items            jsonb,           -- [{sku, quantity, unit_price, snapshot}]
  p_subtotal         numeric,
  p_shipping         numeric default 0,
  p_total            numeric default null,
  p_shipping_address jsonb default null,
  p_notes            text default null
) returns table(order_id uuid, order_number text)
language plpgsql
security invoker
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_user_id       uuid := auth.uid();
  v_user_email    text;
  v_total         numeric;
  v_item          jsonb;
  v_product_id    uuid;
begin
  -- Auth check
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lookup user's email
  select email into v_user_email from customers where id = v_user_id;
  if v_user_email is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  -- Calculate total if not given
  v_total := coalesce(p_total, p_subtotal + p_shipping);

  -- Generate order number (SK-2026-0001)
  v_order_number := generate_order_number();

  -- Insert order
  insert into orders (
    order_number, customer_id, customer_email, status,
    subtotal, shipping, total, currency,
    shipping_address, notes
  ) values (
    v_order_number, v_user_id, v_user_email, 'pending',
    p_subtotal, p_shipping, v_total, 'EUR',
    p_shipping_address, p_notes
  )
  returning id into v_order_id;

  -- Insert order items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- Lookup product UUID from sku
    select id into v_product_id from products where sku = (v_item->>'sku');

    insert into order_items (
      order_id, product_id, product_snapshot,
      quantity, unit_price, line_total
    ) values (
      v_order_id,
      v_product_id,
      v_item->'snapshot',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'unit_price')::numeric * (v_item->>'quantity')::int
    );
  end loop;

  -- Return το order_id + order_number για το frontend
  return query select v_order_id, v_order_number;
end;
$$;

-- Grant execute (απαιτείται για να μπορεί το anon/authenticated να την καλέσει)
grant execute on function public.create_order(jsonb, numeric, numeric, numeric, jsonb, text) to anon, authenticated;
