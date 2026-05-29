-- ============================================================
-- WELCOME-EMAIL ONCE GUARD — προσθέτει customers.welcome_sent_at
-- ώστε το welcome email να φεύγει ΜΟΝΟ μία φορά, ΜΕΤΑ την
-- επιβεβαίωση email (όχι ταυτόχρονα).
--
-- Τρέξε στο Supabase Dashboard → SQL Editor.
-- ============================================================

alter table customers
  add column if not exists welcome_sent_at timestamptz;

-- Backfill: όλους τους ήδη εγγεγραμμένους τους θεωρούμε «sent» ώστε
-- να μην πάρουν welcome στο επόμενό τους login.
update customers
  set welcome_sent_at = now()
  where welcome_sent_at is null;

-- Index — μικρό μέγεθος, χρήσιμο όταν φορτώνουμε «νέους» customers
create index if not exists customers_welcome_sent_at_idx
  on customers(welcome_sent_at);
