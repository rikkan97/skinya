-- ============================================================
-- SKINYA · PRODUCTS PAGE HEADER (3 selectable products L/C/R)
-- Run στο Supabase SQL Editor. Idempotent.
-- --------------------------------------------------------------
-- Προσθέτει entry στο site_sections για το shop (products page)
-- header — τα 3 product photos (.ph-frame--back-left/main/back-right).
--
-- Από admin (Supabase Studio → site_sections → row 'products_header')
-- επεξεργάζεσαι τα 3 SKUs + τα marketing labels στο items array.
--
-- Πεδία ανά slot:
--   slot   — 'left' | 'center' | 'right' (μην το αλλάζεις)
--   sku    — το SKU του προϊόντος (από τον πίνακα products)
--   tag    — η μαρκαρισμένη επιγραφή (★ Cult Favorite κλπ)
--   brand  — short brand label για το mini-label (π.χ. "BoJ"
--            αντί για "Beauty of Joseon"). Παραλείπεται → χρησιμοποιεί p.brand
--   label  — short product name για το mini-label (π.χ. "Snail 96"
--            αντί για "Advanced Snail 96 Mucin Power Essence").
--            Παραλείπεται → χρησιμοποιεί p.name
--
-- Το "N° 01" στο center frame μένει hardcoded (decorative).
-- ============================================================

insert into public.site_sections (id, title, kind, max_items, items) values
  ('products_header',
   'Shop Page · Header (3 Products: L/C/R)',
   'product_list',
   3,
   '[
     {"slot":"left",   "sku":"s1",  "tag":"★ Cult Favorite",            "brand":"COSRX", "label":"Snail 96"},
     {"slot":"center", "sku":"t1",  "tag":"★ Best Seller · TikTok Viral"},
     {"slot":"right",  "sku":"sp1", "tag":"★ Viral SPF",                "brand":"BoJ",   "label":"Relief Sun"}
   ]'::jsonb)
on conflict (id) do update set
  title     = excluded.title,
  kind      = excluded.kind,
  max_items = excluded.max_items;
-- NOT updating items στο conflict — διατηρεί ό,τι έχεις ήδη αλλάξει

select id, title, max_items, items from public.site_sections
  where id = 'products_header';
