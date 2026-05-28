-- ============================================================
-- SKINYA · LOAD ABANDONED CART
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- Επιστρέφει το αποθηκευμένο cart του logged-in user ώστε να
-- κάνει restore όταν συνδέεται από άλλη συσκευή.
-- Δεν επιστρέφει τίποτα αν:
--   • δεν είναι logged-in
--   • δεν υπάρχει αποθηκευμένο cart
--   • το cart έχει ήδη recovered (έχει κάνει checkout)
-- ============================================================

create or replace function public.load_abandoned_cart()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_email text;
  v_items jsonb;
begin
  if uid is null then return null; end if;
  select email into v_email from customers where id = uid;
  if v_email is null then return null; end if;

  select items into v_items
    from abandoned_carts
   where email = lower(v_email)
     and recovered_at is null
   limit 1;

  return v_items;   -- null αν δεν υπάρχει
end $$;
grant execute on function public.load_abandoned_cart() to authenticated;
