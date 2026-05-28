-- ============================================================
-- NEWSLETTER SUBSCRIBERS — public form (homepage) signups
-- Run this in Supabase SQL Editor.
-- Anonymous users can INSERT; only admins can SELECT/UPDATE.
-- ============================================================

create table if not exists newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  source          text default 'homepage',          -- 'homepage' | 'checkout' | 'footer' | ...
  subscribed_at   timestamptz default now(),
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_email_idx on newsletter_subscribers(lower(email));
create index if not exists newsletter_subscribers_subscribed_idx on newsletter_subscribers(subscribed_at desc);

alter table newsletter_subscribers enable row level security;

-- Anonymous + authenticated: μπορούν να κάνουν INSERT (εγγραφή)
drop policy if exists "anyone can subscribe" on newsletter_subscribers;
create policy "anyone can subscribe" on newsletter_subscribers
  for insert with check (true);

-- Μόνο admins διαβάζουν τη λίστα
drop policy if exists "admins read subscribers" on newsletter_subscribers;
create policy "admins read subscribers" on newsletter_subscribers
  for select using (is_admin());

-- Μόνο admins ενημερώνουν (π.χ. unsubscribed_at, source)
drop policy if exists "admins update subscribers" on newsletter_subscribers;
create policy "admins update subscribers" on newsletter_subscribers
  for update using (is_admin());

-- Μόνο admins διαγράφουν
drop policy if exists "admins delete subscribers" on newsletter_subscribers;
create policy "admins delete subscribers" on newsletter_subscribers
  for delete using (is_admin());
