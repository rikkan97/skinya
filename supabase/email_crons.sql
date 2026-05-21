-- ============================================================
-- SKINYA · CRON SCHEDULES για email functions
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- Προϋποθέσεις:
--   • Extensions: pg_cron + pg_net  (Dashboard → Database → Extensions → enable)
--   • Deploy των functions: low-stock-alert, send-abandoned-carts
--   • Στα settings ΚΑΘΕ function: Verify JWT = OFF (καλούνται από cron, χωρίς JWT)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A3 · Low stock digest — κάθε μέρα 09:00 (UTC· π.χ. ~11:00 ώρα Ελλάδας)
select cron.schedule(
  'skinya-low-stock-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url := 'https://swkdewwmmxsftdmzjqsr.supabase.co/functions/v1/low-stock-alert',
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  $$
);

-- #12 · Abandoned cart reminders — κάθε ώρα
select cron.schedule(
  'skinya-abandoned-carts-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url := 'https://swkdewwmmxsftdmzjqsr.supabase.co/functions/v1/send-abandoned-carts',
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  $$
);

-- Για να δεις/σβήσεις:
--   select * from cron.job;
--   select cron.unschedule('skinya-low-stock-daily');
--   select cron.unschedule('skinya-abandoned-carts-hourly');
