-- ============================================================
-- SKINYA · WELCOME DISCOUNT (10% πρώτης παραγγελίας) + anti-abuse
-- Τρέξε στο Supabase SQL Editor ΑΦΟΥ έχει τρέξει το checkout_payment.sql.
-- ------------------------------------------------------------
-- Ενσωματώνεται ΜΕΣΑ στην create_order (server-side υπολογισμός),
-- γιατί η create_order αγνοεί το p_total και ξαναϋπολογίζει το σύνολο.
--
-- Anti-abuse: 1 welcome ανά λογαριασμό (0 προηγούμενες παραγγελίες)
-- ΚΑΙ 1 ανά κανονικοποιημένο τηλέφωνο ΚΑΙ 1 ανά διεύθυνση —
-- ώστε να μην φαρμάρεται με νέα emails.
-- ============================================================

-- 1) Στήλη για reporting (πόση welcome έκπτωση δόθηκε ανά order)
alter table orders add column if not exists welcome_discount numeric default 0;

-- 2) Πίνακας εξαργυρώσεων — unique ανά τηλέφωνο & ανά διεύθυνση
create table if not exists welcome_redemptions(
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references customers(id) on delete set null,
  phone_norm   text,
  address_hash text,
  order_id     uuid references orders(id) on delete cascade,
  created_at   timestamptz default now()
);
create unique index if not exists welcome_redemptions_phone_idx
  on welcome_redemptions(phone_norm)  where phone_norm  is not null;
create unique index if not exists welcome_redemptions_addr_idx
  on welcome_redemptions(address_hash) where address_hash is not null;

alter table welcome_redemptions enable row level security;
-- (χωρίς policies → προσβάσιμο μόνο μέσω security-definer functions)

-- 3) Helpers — κανονικοποίηση τηλεφώνου & διεύθυνσης
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  -- κράτα μόνο ψηφία, πάρε τα τελευταία 10 (αγνοεί +30 / 0030 / κενά)
  select nullif(right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10), '');
$$;

create or replace function public.normalize_address(addr jsonb)
returns text language sql immutable as $$
  select md5(
    lower(regexp_replace(coalesce(addr->>'line1',''), '\s+', ' ', 'g')) || '|' ||
    regexp_replace(coalesce(addr->>'postcode',''), '\D', '', 'g')
  );
$$;

-- 4) Eligibility για το frontend: logged-in & 0 προηγούμενες παραγγελίες.
--    Ελέγχει ΚΑΙ με customer_id ΚΑΙ με email — ώστε να μετράνε και παλιές
--    guest παραγγελίες που έγιναν με το ίδιο email (customer_id = null).
create or replace function public.welcome_eligible()
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid     uuid := auth.uid();
  v_email text;
begin
  if uid is null then return false; end if;
  select email into v_email from customers where id = uid;
  return not exists (
    select 1 from orders
    where customer_id = uid
       or (v_email is not null and lower(customer_email) = lower(v_email))
  );
end $$;
grant execute on function public.welcome_eligible() to authenticated;

-- ============================================================
-- 5) create_order — ίδιο με checkout_payment.sql + WELCOME (p_welcome)
-- ============================================================
drop function if exists public.create_order(jsonb, numeric, numeric, numeric, jsonb, text, text, boolean, text, text);

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
  p_coupon_code      text default null,
  p_welcome          boolean default false
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
  v_welcome       numeric := 0;
  v_phone         text;
  v_addr          text;
  v_total         numeric;
  v_item          jsonb;
  v_product_id    uuid;
begin
  -- Αποδοχή όρων υποχρεωτική
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

  -- ── Κουπόνι (server-side validation + υπολογισμός έκπτωσης) ──
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

  -- ── WELCOME 10% πρώτης παραγγελίας (server-side, anti-abuse) ──
  -- Ισχύει και για logged-in ΚΑΙ για guests. Για guests ο μόνος έλεγχος
  -- είναι το dedup ανά τηλέφωνο/διεύθυνση (δεν υπάρχει λογαριασμός).
  if p_welcome is true then
    if v_coupon_code is not null then
      raise exception 'WELCOME_COUPON_CONFLICT';   -- δεν συνδυάζονται
    end if;
    -- Logged-in: πρέπει να είναι η 1η παραγγελία (έλεγχος με customer_id ΚΑΙ email,
    -- ώστε να μετράνε και παλιές guest παραγγελίες με το ίδιο email).
    if v_user_id is not null and exists (
      select 1 from orders
      where customer_id = v_user_id
         or lower(customer_email) = lower(v_user_email)
    ) then
      raise exception 'WELCOME_NOT_FIRST';
    end if;
    v_phone := normalize_phone(p_shipping_address->>'phone');
    v_addr  := normalize_address(p_shipping_address);
    if exists (
      select 1 from welcome_redemptions
      where (phone_norm   is not null and phone_norm   = v_phone)
         or (address_hash is not null and address_hash = v_addr)
    ) then
      raise exception 'WELCOME_USED';
    end if;
    v_welcome := round(p_subtotal * 0.10, 2);
    if v_welcome > p_subtotal then v_welcome := p_subtotal; end if;
  end if;

  -- Σύνολο (authoritative, με έκπτωση κουπονιού + welcome)
  v_total := round(p_subtotal + p_shipping - v_discount - v_welcome, 2);
  if v_total < 0 then v_total := 0; end if;

  v_order_number := generate_order_number();

  insert into orders (
    order_number, customer_id, customer_email, status,
    subtotal, discount, welcome_discount, shipping, total, currency, coupon_code,
    shipping_address, notes, is_guest, terms_accepted_at, payment_method
  ) values (
    v_order_number, v_user_id, v_user_email, 'pending',
    p_subtotal, v_discount, v_welcome, p_shipping, v_total, 'EUR', v_coupon_code,
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

  -- Αύξησε το uses_count του κουπονιού
  if v_coupon.id is not null then
    update coupons set uses_count = uses_count + 1 where id = v_coupon.id;
  end if;

  -- Κατέγραψε την welcome εξαργύρωση (το unique index προστατεύει από races)
  if v_welcome > 0 then
    insert into welcome_redemptions(customer_id, phone_norm, address_hash, order_id)
    values (v_user_id, v_phone, v_addr, v_order_id);
  end if;

  return query select v_order_id, v_order_number;
end;
$$;

grant execute on function
  public.create_order(jsonb, numeric, numeric, numeric, jsonb, text, text, boolean, text, text, boolean)
  to anon, authenticated;
