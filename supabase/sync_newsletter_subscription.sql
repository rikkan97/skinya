-- ============================================================
-- SKINYA · SYNC NEWSLETTER SUBSCRIPTION (profile ↔ subscribers)
-- Τρέξε στο Supabase SQL Editor.
-- ------------------------------------------------------------
-- ΓΙΑΤΙ: Το profile newsletter checkbox έγραφε ΜΟΝΟ στο
-- customers.newsletter. Δεν συγχρονιζόταν με το
-- newsletter_subscribers (την επίσημη λίστα για campaigns), οπότε
-- subscribers που τίκαραν από το profile χάνονταν.
--
-- Το RLS του newsletter_subscribers επιτρέπει σε απλό user ΜΟΝΟ
-- insert (όχι update → άρα δεν μπορεί να κάνει unsubscribe μόνος).
-- Αυτό το security-definer RPC το κάνει RLS-safe: χειρίζεται ΜΟΝΟ
-- το email του ίδιου του logged-in user (από customers via auth.uid).
--
-- p_subscribe = true  → (re)subscribe (unsubscribed_at = null)
-- p_subscribe = false → unsubscribe (unsubscribed_at = now)
-- ============================================================

create or replace function public.sync_newsletter_subscription(p_subscribe boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_email text;
begin
  if uid is null then return; end if;
  select lower(trim(email)) into v_email from customers where id = uid;
  if v_email is null then return; end if;

  if p_subscribe then
    insert into newsletter_subscribers (email, source, subscribed_at, unsubscribed_at)
    values (v_email, 'profile', now(), null)
    on conflict (email) do update
      set unsubscribed_at = null,
          subscribed_at   = coalesce(newsletter_subscribers.subscribed_at, now());
  else
    update newsletter_subscribers
       set unsubscribed_at = now()
     where email = v_email and unsubscribed_at is null;
  end if;
end $$;

grant execute on function public.sync_newsletter_subscription(boolean) to authenticated;
