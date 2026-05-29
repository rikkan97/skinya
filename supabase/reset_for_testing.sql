-- ============================================================
-- RESET FOR TESTING — διαγραφή όλων των accounts/orders/carts/
-- newsletter signups ΕΚΤΟΣ από hello@skinya.gr (admin).
--
-- ⚠️  DESTRUCTIVE — δεν αναιρείται.
-- Τρέξε στο Supabase Dashboard → SQL Editor.
--
-- Πριν τρέξεις:
--   1) Σιγουρέψου ότι υπάρχει user hello@skinya.gr στο Authentication.
--      Αν όχι: Auth → Users → Add User (αυτο-confirm email).
--   2) Παίξε το STEP 0 πρώτο για να δεις ότι όντως βρίσκει τον admin.
--   3) Μόνο τότε τρέξε τα υπόλοιπα.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- STEP 0 — SANITY CHECK (πρέπει να επιστρέψει 1 row)
-- ──────────────────────────────────────────────────────────────
select id, email
from auth.users
where lower(email) = 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 1 — DELETE ORDERS + ITEMS (εκτός hello@skinya.gr)
-- order_items έχει on delete cascade, οπότε φεύγουν αυτόματα.
-- ──────────────────────────────────────────────────────────────
delete from orders
where lower(coalesce(customer_email, '')) <> 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 2 — DELETE ABANDONED CARTS (καθαρό slate)
-- ──────────────────────────────────────────────────────────────
delete from abandoned_carts
where lower(coalesce(email, '')) <> 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 3 — DELETE NEWSLETTER SIGNUPS (καθαρό slate)
-- ──────────────────────────────────────────────────────────────
delete from newsletter_subscribers
where lower(email) <> 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 4 — DELETE AUTH USERS (cascades σε customers + addresses)
-- ──────────────────────────────────────────────────────────────
delete from auth.users
where lower(email) <> 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 5 — PROMOTE hello@skinya.gr σε admin
-- ──────────────────────────────────────────────────────────────
update customers
set role = 'admin'
where lower(email) = 'hello@skinya.gr';

-- ──────────────────────────────────────────────────────────────
-- STEP 6 — RESET order number sequence στο 1
--          ώστε η πρώτη test παραγγελία να βγει SK-YYYY-0001
-- ──────────────────────────────────────────────────────────────
alter sequence order_number_seq restart with 1;

-- ──────────────────────────────────────────────────────────────
-- STEP 7 — VERIFY (όλα πρέπει 0 ή 1)
-- ──────────────────────────────────────────────────────────────
select 'auth.users'             as table_name, count(*) as rows from auth.users
union all select 'customers',              count(*) from customers
union all select 'addresses',              count(*) from addresses
union all select 'orders',                 count(*) from orders
union all select 'order_items',            count(*) from order_items
union all select 'newsletter_subscribers', count(*) from newsletter_subscribers
union all select 'abandoned_carts',        count(*) from abandoned_carts;
