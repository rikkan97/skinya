-- ============================================================
-- SKINYA · ABANDONED CART (#12)
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- Αποθηκεύει το καλάθι ΣΥΝΔΕΔΕΜΕΝΩΝ χρηστών (1 row ανά email).
-- Ένα cron (send-abandoned-carts) στέλνει υπενθύμιση μετά από
-- αδράνεια, μία φορά ανά εγκαταλειμμένο καλάθι.
-- ============================================================

create table if not exists abandoned_carts(
  email        text primary key,
  customer_id  uuid references customers(id) on delete set null,
  items        jsonb not null default '[]',
  subtotal     numeric default 0,
  updated_at   timestamptz default now(),
  reminded_at  timestamptz,
  recovered_at timestamptz
);

alter table abandoned_carts enable row level security;
-- (χωρίς policies → μόνο μέσω των security-definer RPCs / service role)

-- Αποθήκευση/ανανέωση καλαθιού (από το frontend όταν αλλάζει το cart)
create or replace function public.save_abandoned_cart(p_items jsonb, p_subtotal numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_email text;
begin
  if uid is null then return; end if;                 -- μόνο logged-in
  select email into v_email from customers where id = uid;
  if v_email is null then return; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then return; end if;

  insert into abandoned_carts(email, customer_id, items, subtotal, updated_at, reminded_at, recovered_at)
  values (lower(v_email), uid, p_items, coalesce(p_subtotal,0), now(), null, null)
  on conflict (email) do update
    set items = excluded.items,
        subtotal = excluded.subtotal,
        customer_id = excluded.customer_id,
        updated_at = now(),
        reminded_at = null,      -- reset → νέα αδράνεια μετράει από τώρα
        recovered_at = null;
end $$;
grant execute on function public.save_abandoned_cart(jsonb, numeric) to authenticated;

-- Καθάρισμα μετά από επιτυχημένη παραγγελία (mark recovered)
create or replace function public.clear_abandoned_cart()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_email text;
begin
  if uid is null then return; end if;
  select email into v_email from customers where id = uid;
  if v_email is null then return; end if;
  update abandoned_carts set recovered_at = now() where email = lower(v_email);
end $$;
grant execute on function public.clear_abandoned_cart() to authenticated;
