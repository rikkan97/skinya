-- ============================================================
-- SKINYA · STOCK RESTORE ON CANCEL / REFUND
-- --------------------------------------------------------------
-- Όταν παραγγελία αλλάζει σε status 'cancelled' ή 'refunded',
-- επιστρέφει στο stock όσα τεμάχια είχαν αφαιρεθεί κατά την
-- δημιουργία της (μέσω create_order).
--
-- Λογική:
--   • Trigger AFTER UPDATE OF status ON orders
--   • Fires ΜΟΝΟ όταν η ΠΡΟΗΓΟΥΜΕΝΗ status ΔΕΝ ήταν cancelled/refunded
--     και η νέα είναι (idempotent — δεν διπλο-επαναφέρει stock).
--   • Loop στα order_items, increment products.stock με FOR UPDATE
--     lock (atomicity ενάντια σε ταυτόχρονες αγορές).
--   • Realtime publication ήδη ενεργό → admin βλέπει live update.
-- --------------------------------------------------------------
-- Run μετά το stock_decrement.sql. Idempotent.
-- ============================================================

create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_active boolean;
  v_is_cancel  boolean;
  v_item       record;
begin
  v_was_active := OLD.status not in ('cancelled', 'refunded');
  v_is_cancel  := NEW.status     in ('cancelled', 'refunded');

  -- Επαναφορά μόνο σε transition active → cancelled/refunded
  if v_was_active and v_is_cancel then
    for v_item in
      select product_id, quantity
        from order_items
       where order_id = NEW.id
         and product_id is not null
    loop
      update products
         set stock = coalesce(stock, 0) + v_item.quantity
       where id = v_item.product_id;
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists orders_restore_stock_on_cancel on orders;
create trigger orders_restore_stock_on_cancel
  after update of status on orders
  for each row
  execute function public.restore_stock_on_cancel();
