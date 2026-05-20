-- ============================================================
-- SKINYA · SITE SECTIONS (admin-managed UI content)
-- Run στο Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.site_sections (
  id          text primary key,
  title       text not null,
  kind        text not null default 'product_list',   -- 'product_list' | 'founders'
  max_items   int  default 6,
  items       jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- RLS: public read (shop χρειάζεται να διαβάζει), admin write
alter table public.site_sections enable row level security;

drop policy if exists "site_sections public read" on public.site_sections;
create policy "site_sections public read" on public.site_sections for select using (true);

drop policy if exists "site_sections admin write" on public.site_sections;
create policy "site_sections admin write" on public.site_sections for all using (is_admin()) with check (is_admin());

-- Auto updated_at
create or replace function _site_sections_touch() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

drop trigger if exists site_sections_touch on public.site_sections;
create trigger site_sections_touch before update on public.site_sections
  for each row execute function _site_sections_touch();

-- ============================================================
-- SEED: αρχικές τιμές με τα τρέχοντα προϊόντα που εμφανίζονται
-- ============================================================
insert into public.site_sections (id, title, kind, max_items, items) values

-- Home favorites carousel
('home_favorites', 'Αγαπημένα · Home Carousel', 'product_list', 6,
  '[{"sku":"t1"},{"sku":"s1"},{"sku":"sp1"}]'::jsonb),

-- Home Shop tabbed section (8 κατηγορίες · 4 προϊόντα η καθεμία)
('home_shop_cleansers',    'Home Shop · Καθαρισμός',          'product_list', 4, '[{"sku":"cl1"},{"sku":"cl2"},{"sku":"cl3"},{"sku":"cl4"}]'::jsonb),
('home_shop_toners',       'Home Shop · Toners & Pads',       'product_list', 4, '[{"sku":"t1"},{"sku":"t2"},{"sku":"t3"},{"sku":"t4"}]'::jsonb),
('home_shop_serums',       'Home Shop · Serums & Essences',   'product_list', 4, '[{"sku":"s1"},{"sku":"s2"},{"sku":"s3"},{"sku":"s4"}]'::jsonb),
('home_shop_eyes',         'Home Shop · Eye Care',            'product_list', 4, '[{"sku":"e1"},{"sku":"e2"},{"sku":"e3"}]'::jsonb),
('home_shop_moisturizers', 'Home Shop · Κρέμες & Ενυδατικές', 'product_list', 4, '[{"sku":"m1"},{"sku":"m2"},{"sku":"m3"},{"sku":"m4"}]'::jsonb),
('home_shop_spf',          'Home Shop · Αντηλιακά',           'product_list', 4, '[{"sku":"sp1"},{"sku":"sp2"},{"sku":"sp3"},{"sku":"sp4"}]'::jsonb),
('home_shop_masks',        'Home Shop · Μάσκες',              'product_list', 4, '[{"sku":"mk1"},{"sku":"mk2"},{"sku":"mk3"},{"sku":"mk4"}]'::jsonb),
('home_shop_body',         'Home Shop · Χέρια & Πόδια',       'product_list', 4, '[{"sku":"b1"},{"sku":"b2"},{"sku":"b3"}]'::jsonb),

-- Routine pages
('morning_routine', 'Πρωινή Ρουτίνα · 6 βήματα', 'product_list', 6,
  '[{"sku":"cl4"},{"sku":"t1"},{"sku":"s9"},{"sku":"e3"},{"sku":"m4"},{"sku":"sp1"}]'::jsonb),

('night_routine', 'Βραδινή Ρουτίνα · 7 βήματα', 'product_list', 7,
  '[{"sku":"cl1"},{"sku":"cl2"},{"sku":"t4"},{"sku":"s1"},{"sku":"s7"},{"sku":"e1"},{"sku":"m1"}]'::jsonb),

('weekly_routine', 'Weekly Masks · 3 προϊόντα', 'product_list', 3,
  '[{"sku":"mk1"},{"sku":"mk2"},{"sku":"mk3"}]'::jsonb),

-- Founders (different kind — each item έχει name/role/photo/bio)
('founders', 'Founders · About page', 'founders', 4,
  '[
    {"name":"Στρατός Προκοπιάδης","role":"Co-Founder","photo":"","bio":"Skincare enthusiast με αγάπη για το design."},
    {"name":"Τζένη Κουδουδάκη","role":"Co-Founder","photo":"","bio":"Μαμά με αισθητικό νου και αγάπη για τη λεπτομέρεια."}
  ]'::jsonb)

on conflict (id) do update set
  title     = excluded.title,
  kind      = excluded.kind,
  max_items = excluded.max_items;
-- Σημείωση: NOT updating items στο conflict — διατηρεί ό,τι έχεις ήδη αλλάξει

select id, title, kind, max_items, jsonb_array_length(items) as items_count from site_sections order by id;
