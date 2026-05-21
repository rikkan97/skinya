-- ============================================================
-- SKINYA · GUEST CHECKOUT + ΑΠΟΔΟΧΗ ΟΡΩΝ
-- Τρέξε στο Supabase SQL Editor ΑΦΟΥ έχεις τρέξει schema.sql + checkout_function.sql
-- --------------------------------------------------------------
-- • Επιτρέπει αγορά ως επισκέπτης (χωρίς λογαριασμό) — η παραγγελία
--   αποθηκεύεται κανονικά στα orders με is_guest = true (tag «επισκέπτης»).
-- • Καταγράφει την αποδοχή όρων (terms_accepted_at) στο τελικό checkout.
-- ============================================================

-- 1) Νέες στήλες στον πίνακα orders ---------------------------
alter table orders add column if not exists is_guest          boolean default false;
alter table orders add column if not exists terms_accepted_at timestamptz;

-- 2) Ενημερωμένη create_order (guest-aware + terms) -----------
-- Διώχνουμε την παλιά υπογραφή πριν την ξαναφτιάξουμε με νέα παραμέτρια.
drop function if exists public.create_order(jsonb, numeric, numeric, numeric, jsonb, text);

create or replace function public.create_order(
  p_items            jsonb,           -- [{sku, quantity, unit_price, snapshot}]
  p_subtotal         numeric,
  p_shipping         numeric default 0,
  p_total            numeric default null,
  p_shipping_address jsonb default null,
  p_notes            text default null,
  p_guest_email      text default null,   -- email επισκέπτη (όταν δεν υπάρχει login)
  p_terms_accepted   boolean default false -- αποδοχή όρων στο τελικό checkout
) returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_user_id       uuid := auth.uid();
  v_user_email    text;
  v_is_guest      boolean := false;
  v_total         numeric;
  v_item          jsonb;
  v_product_id    uuid;
begin
  -- Η αποδοχή όρων είναι ΥΠΟΧΡΕΩΤΙΚΗ για κάθε παραγγελία
  if p_terms_accepted is not true then
    raise exception 'TERMS_NOT_ACCEPTED';
  end if;

  if v_user_id is not null then
    -- Συνδεδεμένος πελάτης
    select email into v_user_email from customers where id = v_user_id;
    if v_user_email is null then
      raise exception 'CUSTOMER_NOT_FOUND';
    end if;
  else
    -- Αγορά ως επισκέπτης (χωρίς λογαριασμό)
    v_is_guest   := true;
    v_user_email := nullif(trim(p_guest_email), '');
    if v_user_email is null then
      raise exception 'GUEST_EMAIL_REQUIRED';
    end if;
  end if;

  -- Σύνολο αν δεν δόθηκε
  v_total := coalesce(p_total, p_subtotal + p_shipping);

  -- Αριθμός παραγγελίας (SK-2026-0001)
  v_order_number := generate_order_number();

  -- Insert order (customer_id = null για guest)
  insert into orders (
    order_number, customer_id, customer_email, status,
    subtotal, shipping, total, currency,
    shipping_address, notes, is_guest, terms_accepted_at
  ) values (
    v_order_number, v_user_id, v_user_email, 'pending',
    p_subtotal, p_shipping, v_total, 'EUR',
    p_shipping_address, p_notes, v_is_guest, now()
  )
  returning id into v_order_id;

  -- Insert order items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
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

  return query select v_order_id, v_order_number;
end;
$$;

-- Grant execute — anon (επισκέπτες) + authenticated (συνδεδεμένοι)
grant execute on function
  public.create_order(jsonb, numeric, numeric, numeric, jsonb, text, text, boolean)
  to anon, authenticated;

-- 3) Table-level grants ώστε ο anon (επισκέπτης) να μπορεί να γράψει.
-- Η πρόσβαση παραμένει φραγμένη από τα RLS policies (insert μόνο όταν
-- customer_id is null), αλλά το INSERT grant πρέπει να υπάρχει σε επίπεδο table.
grant insert on orders      to anon, authenticated;
grant insert on order_items to anon, authenticated;

-- 4) RLS POLICIES — (επανα)δημιουργία ώστε να επιτρέπεται το guest insert.
-- Η live βάση μπορεί να έχει παλιότερη έκδοση χωρίς το «customer_id is null»,
-- γι' αυτό τα ξαναφτιάχνουμε εδώ (idempotent — drop if exists + create).
alter table orders      enable row level security;
alter table order_items enable row level security;

-- ORDERS: insert όταν είναι δικιά του (logged-in) Ή guest (customer_id is null)
drop policy if exists "orders insert own" on orders;
create policy "orders insert own" on orders for insert
  with check (auth.uid() = customer_id or customer_id is null);

-- ORDER ITEMS: insert αν το order είναι δικό του ή guest order
drop policy if exists "order items insert via order" on order_items;
create policy "order items insert via order" on order_items for insert
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or o.customer_id is null)
    )
  );

