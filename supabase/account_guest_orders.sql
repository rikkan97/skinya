-- ============================================================
-- SKINYA · Σύνδεση guest παραγγελιών με τον λογαριασμό μέσω email
-- --------------------------------------------------------------
-- Ο συνδεδεμένος χρήστης βλέπει στον λογαριασμό του:
--   • τις παραγγελίες με customer_id = το δικό του (logged-in orders), ΚΑΙ
--   • τις guest παραγγελίες που έγιναν με το ίδιο (verified) email του.
-- Το frontend query δεν αλλάζει — βασίζεται στο RLS.
-- Run στο Supabase SQL Editor. Idempotent (drop + create).
-- ============================================================

-- ORDERS: read own (by id) Ή guest orders με το email του χρήστη Ή admin
drop policy if exists "orders read own" on orders;
create policy "orders read own" on orders for select using (
  auth.uid() = customer_id
  or lower(customer_email) = lower(auth.jwt() ->> 'email')
  or is_admin()
);

-- ORDER ITEMS: ορατά αν ανήκουν σε παραγγελία που βλέπει ο χρήστης (κατά τα παραπάνω)
drop policy if exists "order items via order" on order_items;
create policy "order items via order" on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and (
        o.customer_id = auth.uid()
        or lower(o.customer_email) = lower(auth.jwt() ->> 'email')
        or is_admin()
      )
  )
);
