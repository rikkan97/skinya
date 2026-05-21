-- ============================================================
-- SKINYA · STORE SETTINGS (τραπεζικός λογαριασμός για κατάθεση)
-- Τρέξε στο Supabase SQL Editor.
-- --------------------------------------------------------------
-- Single-row πίνακας (id = 1) με τα στοιχεία τραπεζικής κατάθεσης
-- που εμφανίζονται στο checkout. Διαχειρίζεται από το admin (tab
-- «Τραπεζικός λογ/σμός»), διαβάζεται δημόσια από το site.
-- ============================================================

create table if not exists store_settings (
  id           smallint primary key default 1,
  bank_name    text,          -- Επωνυμία τράπεζας (π.χ. Εθνική / Πειραιώς)
  bank_holder  text,          -- Δικαιούχος λογαριασμού
  bank_iban    text,          -- IBAN
  bank_swift   text,          -- BIC / SWIFT (προαιρετικό)
  bank_note    text,          -- Οδηγίες/σημείωση προς τον πελάτη
  updated_at   timestamptz default now(),
  constraint store_settings_singleton check (id = 1)
);

-- Σιγουρεύουμε ότι υπάρχει η μοναδική γραμμή
insert into store_settings (id) values (1) on conflict (id) do nothing;

alter table store_settings enable row level security;

-- Public read — το checkout διαβάζει το IBAN χωρίς login
drop policy if exists "public read store settings" on store_settings;
create policy "public read store settings" on store_settings for select using (true);

-- Admin write — μόνο admins ενημερώνουν
drop policy if exists "admin write store settings" on store_settings;
create policy "admin write store settings" on store_settings
  for all using (is_admin()) with check (is_admin());

grant select on store_settings to anon, authenticated;
grant insert, update on store_settings to authenticated;
