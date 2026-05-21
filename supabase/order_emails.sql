-- ============================================================
-- SKINYA · ORDER EMAILS + SHIPPING (carrier / tracking)
-- Τρέξε στο Supabase SQL Editor ΑΦΟΥ έχεις τρέξει schema.sql,
-- checkout_function.sql και guest_checkout.sql.
-- --------------------------------------------------------------
-- Προσθέτει τα πεδία αποστολής (μεταφορική + tracking) και δύο
-- timestamps που αποτρέπουν διπλή αποστολή email:
--   • received_email_sent_at → email «Λάβαμε την παραγγελία σας»
--   • shipped_email_sent_at  → email «Στάλθηκε με <μεταφορική> #<tracking>»
-- Δεν αλλάζει το order_status enum — χρησιμοποιούμε υποσύνολο
-- (pending / shipped / cancelled) από το admin.
-- ============================================================

alter table orders add column if not exists carrier                text;
alter table orders add column if not exists tracking_number        text;
alter table orders add column if not exists received_email_sent_at timestamptz;
alter table orders add column if not exists shipped_email_sent_at   timestamptz;
