-- ============================================================
-- SKINYA · SERVER-SIDE "received" EMAIL TRIGGER
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- ΓΙΑΤΙ: Το "Λάβαμε την παραγγελία σου" email καλούνταν από τον
-- browser (cart.js fire-and-forget). Σε card payments ο browser
-- κάνει redirect στο Viva ΑΜΕΣΩΣ → το request σκοτωνόταν → email
-- χανόταν. Με DB trigger, το email φεύγει server-side σε κάθε νέα
-- παραγγελία, ανεξάρτητα από browser/redirect/network.
--
-- ΑΣΦΑΛΕΙΑ:
-- • Δεν αγγίζει το create_order RPC.
-- • pg_net.http_post είναι async — μπαίνει σε queue και τρέχει
--   ΜΕΤΑ το commit, άρα τα order_items υπάρχουν όταν φτάσει το
--   request στο edge function.
-- • Αν το http_post αποτύχει, ΔΕΝ κάνει rollback την παραγγελία
--   (pg_net errors δεν προπαγκάρουν στο trigger).
-- • Το edge function κάνει dedupe (received_email_sent_at), οπότε
--   ακόμα κι αν τρέξει 2× δεν στέλνει διπλό.
--
-- ΜΕΤΑ από αυτό: αφαιρείται το frontend received-invoke από cart.js
-- (single source of truth → καθόλου race condition).
-- ============================================================

create or replace function public.trg_send_received_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform net.http_post(
    url     := 'https://swkdewwmmxsftdmzjqsr.supabase.co/functions/v1/send-order-email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('type', 'received', 'order_id', NEW.id::text)
  );
  return NEW;
exception
  when others then
    -- best-effort: ποτέ μη ρίξεις την παραγγελία λόγω email glitch
    return NEW;
end;
$$;

drop trigger if exists trg_order_received_email on public.orders;
create trigger trg_order_received_email
  after insert on public.orders
  for each row
  execute function public.trg_send_received_email();
