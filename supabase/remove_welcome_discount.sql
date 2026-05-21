-- ============================================================
-- SKINYA · REMOVE welcome discount (επαναφορά — μόνο κουπόνια)
-- Επαναφέρει την create_order στην έκδοση χωρίς p_welcome και
-- αφαιρεί τα welcome objects. Οι εκπτώσεις γίνονται ΜΟΝΟ με κουπόνια.
-- ============================================================

-- 1) Drop την welcome (11-arg) έκδοση
drop function if exists public.create_order(jsonb, numeric, numeric, numeric, jsonb, text, text, boolean, text, text, boolean);

-- 2) Επαναφορά της original create_order (10-arg, μόνο κουπόνι)
create or replace function public.create_order(
  p_items            jsonb,
  p_subtotal         numeric,
  p_shipping         numeric default 0,
  p_total            numeric default null,
  p_shipping_address jsonb default null,
  p_notes            text default null,
  p_guest_email      text default null,
  p_terms_accepted   boolean default false,
  p_payment_method   text default 'bank_transfer',
  p_coupon_code      text default null
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
  v_payment       text;
  v_coupon_code   text;
  v_coupon        coupons%rowtype;
  v_discount      numeric := 0;
  v_total         numeric;
  v_item          jsonb;
  v_product_id    uuid;
begin
  if p_terms_accepted is not true then
    raise exception 'TERMS_NOT_ACCEPTED';
  end if;

  v_payment := lower(coalesce(nullif(trim(p_payment_method), ''), 'bank_transfer'));
  if v_payment not in ('card','bank_transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if v_user_id is not null then
    select email into v_user_email from customers where id = v_user_id;
    if v_user_email is null then
      raise exception 'CUSTOMER_NOT_FOUND';
    end if;
  else
    v_is_guest   := true;
    v_user_email := nullif(trim(p_guest_email), '');
    if v_user_email is null then
      raise exception 'GUEST_EMAIL_REQUIRED';
    end if;
  end if;

  v_coupon_code := nullif(upper(trim(p_coupon_code)), '');
  if v_coupon_code is not null then
    select * into v_coupon from coupons
      where upper(code) = v_coupon_code
        and is_active = true
        and (valid_from  is null or valid_from  <= now())
        and (valid_until is null or valid_until >= now())
      limit 1;
    if v_coupon.id is null then raise exception 'COUPON_INVALID'; end if;
    if v_coupon.min_order_amount is not null and p_subtotal < v_coupon.min_order_amount then
      raise exception 'COUPON_MIN_ORDER';
    end if;
    if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
      raise exception 'COUPON_EXHAUSTED';
    end if;
    if v_coupon.discount_kind = 'percentage' then
      v_discount := round(p_subtotal * v_coupon.discount_value / 100.0, 2);
    else
      v_discount := v_coupon.discount_value;
    end if;
    if v_discount > p_subtotal then v_discount := p_subtotal; end if;
  end if;

  v_total := round(p_subtotal + p_shipping - v_discount, 2);
  if v_total < 0 then v_total := 0; end if;

  v_order_number := generate_order_number();

  insert into orders (
    order_number, customer_id, customer_email, status,
    subtotal, discount, shipping, total, currency, coupon_code,
    shipping_address, notes, is_guest, terms_accepted_at, payment_method
  ) values (
    v_order_number, v_user_id, v_user_email, 'pending',
    p_subtotal, v_discount, p_shipping, v_total, 'EUR', v_coupon_code,
    p_shipping_address, p_notes, v_is_guest, now(), v_payment
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id into v_product_id from products where sku = (v_item->>'sku');
    insert into order_items (
      order_id, product_id, product_snapshot,
      quantity, unit_price, line_total
    ) values (
      v_order_id, v_product_id, v_item->'snapshot',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'unit_price')::numeric * (v_item->>'quantity')::int
    );
  end loop;

  if v_coupon.id is not null then
    update coupons set uses_count = uses_count + 1 where id = v_coupon.id;
  end if;

  return query select v_order_id, v_order_number;
end;
$$;

grant execute on function
  public.create_order(jsonb, numeric, numeric, numeric, jsonb, text, text, boolean, text, text)
  to anon, authenticated;

-- 3) Αφαίρεση welcome objects
drop function if exists public.welcome_eligible();
drop table if exists public.welcome_redemptions cascade;
-- (η στήλη orders.welcome_discount μένει — αβλαβής, default 0)
