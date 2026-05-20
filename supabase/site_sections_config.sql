-- ============================================================
-- SKINYA · Add config column to site_sections (for bundle discounts)
-- Run στο Supabase SQL Editor. Idempotent.
-- ============================================================

alter table public.site_sections
  add column if not exists config jsonb default '{}'::jsonb;

-- Set default discounts για τα routine sections
update public.site_sections
  set config = coalesce(config, '{}'::jsonb) || '{"discount": 0.05}'::jsonb
  where id = 'morning_routine'
    and not (config ? 'discount');

update public.site_sections
  set config = coalesce(config, '{}'::jsonb) || '{"discount": 0.08}'::jsonb
  where id = 'night_routine'
    and not (config ? 'discount');

select id, items, config from public.site_sections
  where id in ('morning_routine','night_routine');
