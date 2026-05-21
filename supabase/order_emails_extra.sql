-- ============================================================
-- SKINYA · ORDER EMAILS — extra dedupe columns
-- Τρέξε στο Supabase SQL Editor (μετά το order_emails.sql).
-- ------------------------------------------------------------
-- Νέα timestamps που αποτρέπουν διπλή αποστολή για:
--   • paid_email_sent_at      → «Η πληρωμή σου επιβεβαιώθηκε» (#6)
--   • cancelled_email_sent_at → «Η παραγγελία σου ακυρώθηκε» (#8)
-- (#5 bank instructions μπαίνει ΜΕΣΑ στο received email — χωρίς νέα στήλη.)
-- ============================================================

alter table orders add column if not exists paid_email_sent_at      timestamptz;
alter table orders add column if not exists cancelled_email_sent_at  timestamptz;
