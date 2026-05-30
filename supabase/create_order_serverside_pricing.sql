-- ============================================================
-- SKINYA · CREATE_ORDER — SERVER-SIDE PRICING (security fix)
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- ΓΙΑΤΙ (κρίσιμο security fix):
-- Η παλιά create_order έπαιρνε unit_price + subtotal από το FRONTEND
-- (p_items[].unit_price, p_subtotal). Οποιοσδήποτε με DevTools μπορούσε
-- να στείλει unit_price=0.01 και να αγοράσει τζάμπα. Επίσης το bundle
-- discount «κολλούσε» σε μεμονωμένα προϊόντα μετά από αφαίρεση.
--
-- ΤΩΡΑ:
-- • Η τιμή κάθε προϊόντος υπολογίζεται SERVER-SIDE από products
--   (coalesce(price, default_price)). Το frontend unit_price ΑΓΝΟΕΙΤΑΙ.
-- • Το subtotal υπολογίζεται server-side (το p_subtotal αγνοείται).
-- • Bundle discount: εφαρμόζεται ΜΟΝΟ αν ΟΛΑ τα SKUs ενός bundle
--   (morning_routine / night_routine, από site_sections) υπάρχουν στο
--   order. Το ποσοστό διαβάζεται δυναμικά από site_sections.config.
--   Έτσι ΔΕΝ μπορείς να πάρεις έκπτωση σετ για μεμονωμένο προϊόν.
-- • Coupon: validated server-side (όπως πριν) πάνω στο server subtotal.
--
-- ΙΔΙΟ signature (10 params) → το frontend δεν χρειάζεται καμία αλλαγή·
-- απλά τα τιμολογιακά πεδία που στέλνει αγνοούνται.
-- ============================================================

create or replace function public.create_order(
  p_items jsonb,
  p_subtotal numeric,
  p_shipping numeric default 0,
  p_total numeric default null,
  p_shipping_address jsonb default null,
  p_notes text default null,
  p_guest_email text default null,
  p_terms_accepted boolean default false,
  p_payment_method text default 'bank_transfer',
  p_coupon_code text default null
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  v_subtotal      numeric := 0;          -- SERVER-COMPUTED
  v_total         numeric;
  v_item          jsonb;
  v_product_id    uuid;
  v_qty           int;
  v_stock         int;
  v_sku           text;
  v_product_name  text;
  v_base          numeric;
  v_unit          numeric;
  v_disc_pct      numeric;
  v_order_skus    text[];
  v_bundle_skus   text[];
  v_bundle_disc   jsonb := '{}'::jsonb;   -- {sku: discount_pct}
  v_section       record;
begin
  -- Αποδοχή όρων
  if p_terms_accepted is not true then
    raise exception 'TERMS_NOT_ACCEPTED';
  end if;

  -- Τρόπος πληρωμής
  v_payment := lower(coalesce(nullif(trim(p_payment_method), ''), 'bank_transfer'));
  if v_payment not in ('card','bank_transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  -- Ταυτότητα πελάτη / guest
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

  -- ── SKUs του order (για bundle detection) ──
  select array_agg(elem->>'sku') into v_order_skus
    from jsonb_array_elements(p_items) elem;

  -- ── Bundle detection (δυναμικά από site_sections) ──
  -- Για κάθε γνωστό bundle: αν ΟΛΑ τα SKUs του υπάρχουν στο order,
  -- μαρκάρουμε τα SKUs με το discount % του bundle (max αν επικαλύπτονται).
  for v_section in
    select id, items, config from site_sections
     where id in ('morning_routine','night_routine')
       and items is not null
  loop
    select array_agg(it->>'sku') into v_bundle_skus
      from jsonb_array_elements(v_section.items) it
     where it->>'sku' is not null;

    v_disc_pct := coalesce((v_section.config->>'discount')::numeric, 0);

    if v_disc_pct > 0
       and v_bundle_skus is not null
       and array_length(v_bundle_skus, 1) > 0
       and v_bundle_skus <@ v_order_skus then          -- όλα τα bundle SKUs ⊆ order
      select v_bundle_disc || coalesce(jsonb_object_agg(s, greatest(
               coalesce((v_bundle_disc->>s)::numeric, 0), v_disc_pct)), '{}'::jsonb)
        into v_bundle_disc
        from unnest(v_bundle_skus) s;
    end if;
  end loop;

  -- ── STOCK LOCK + VALIDATE + DECREMENT ──
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sku := v_item->>'sku';
    v_qty := (v_item->>'quantity')::int;

    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY: %', v_sku;
    end if;

    select id, stock, name
      into v_product_id, v_stock, v_product_name
      from products
     where sku = v_sku
       for update;

    if v_product_id is null then
      raise exception 'PRODUCT_NOT_FOUND: %', v_sku;
    end if;

    if coalesce(v_stock, 0) < v_qty then
      raise exception 'INSUFFICIENT_STOCK: % (ζητούμενο %, διαθέσιμο %)',
        coalesce(v_product_name, v_sku), v_qty, coalesce(v_stock, 0);
    end if;

    update products
       set stock = coalesce(stock, 0) - v_qty
     where id = v_product_id;
  end loop;

  -- ── ORDER (placeholder totals — υπολογίζονται από τα items παρακάτω) ──
  v_order_number := generate_order_number();

  insert into orders (
    order_number, customer_id, customer_email, status,
    subtotal, discount, shipping, total, currency, coupon_code,
    shipping_address, notes, is_guest, terms_accepted_at, payment_method
  ) values (
    v_order_number, v_user_id, v_user_email, 'pending',
    0, 0, p_shipping, 0, 'EUR', null,
    p_shipping_address, p_notes, v_is_guest, now(), v_payment
  )
  returning id into v_order_id;

  -- ── ORDER_ITEMS με SERVER-SIDE pricing (+ bundle discount) ──
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sku := v_item->>'sku';
    v_qty := (v_item->>'quantity')::int;

    -- Τιμή ΑΠΟ ΤΗ ΒΑΣΗ — όχι από το frontend
    select coalesce(price, default_price)
      into v_base
      from products where sku = v_sku;
    v_base := coalesce(v_base, 0);

    -- Bundle discount αν το sku ανήκει σε πλήρες σετ
    v_disc_pct := coalesce((v_bundle_disc->>v_sku)::numeric, 0);
    v_unit := round(v_base * (1 - v_disc_pct), 2);

    v_subtotal := v_subtotal + (v_unit * v_qty);

    select id into v_product_id from products where sku = v_sku;

    insert into order_items (
      order_id, product_id, product_snapshot, quantity, unit_price, line_total
    ) values (
      v_order_id, v_product_id, v_item->'snapshot',
      v_qty, v_unit, round(v_unit * v_qty, 2)
    );
  end loop;

  -- ── COUPON (server-side validation πάνω στο SERVER subtotal) ──
  v_coupon_code := nullif(upper(trim(p_coupon_code)), '');
  if v_coupon_code is not null then
    select * into v_coupon from coupons
      where upper(code) = v_coupon_code
        and is_active = true
        and (valid_from  is null or valid_from  <= now())
        and (valid_until is null or valid_until >= now())
      limit 1;

    if v_coupon.id is null then
      raise exception 'COUPON_INVALID';
    end if;
    if v_coupon.min_order_amount is not null and v_subtotal < v_coupon.min_order_amount then
      raise exception 'COUPON_MIN_ORDER';
    end if;
    if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
      raise exception 'COUPON_EXHAUSTED';
    end if;

    if v_coupon.discount_kind = 'percentage' then
      v_discount := round(v_subtotal * v_coupon.discount_value / 100.0, 2);
    else
      v_discount := v_coupon.discount_value;
    end if;
    if v_discount > v_subtotal then v_discount := v_subtotal; end if;
  end if;

  -- ── Σύνολο (authoritative) ──
  v_total := round(v_subtotal + coalesce(p_shipping,0) - v_discount, 2);
  if v_total < 0 then v_total := 0; end if;

  update orders
     set subtotal    = v_subtotal,
         discount    = v_discount,
         total       = v_total,
         coupon_code = v_coupon_code
   where id = v_order_id;

  -- Coupon usage
  if v_coupon.id is not null then
    update coupons set uses_count = uses_count + 1 where id = v_coupon.id;
  end if;

  return query select v_order_id, v_order_number;
end;
$function$;
