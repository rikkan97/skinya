-- ============================================================
-- SKINYA · SEED DATA — Categories, Brands, Products
-- Run this AFTER schema.sql in Supabase SQL Editor.
-- Idempotent: μπορείς να το ξανατρέξεις χωρίς να σπάσει.
-- ============================================================

-- 1) Πρόσθεσε 3 ακόμη columns στον products (απαραίτητα για το frontend)
alter table products add column if not exists key_ingredient text;
alter table products add column if not exists tech_name      text;
alter table products add column if not exists tech_desc      text;

-- ============================================================
-- 2) CATEGORIES (K-beauty routine order)
-- ============================================================
insert into categories (id, name, step, eyebrow, description, sort_order) values
  ('cleansers',    'Καθαρισμός',          'Step 01', 'Cleanse',    'Το πρώτο βήμα — απομακρύνει ρύπους, makeup και αντηλιακό χωρίς να στερεί τη φυσική υγρασία.', 1),
  ('toners',       'Toners & Pads',       'Step 02', 'Tonic',      'Ισορροπία pH, καθαρισμός πόρων και καταπραϋντική φροντίδα.', 2),
  ('serums',       'Serums & Essences',   'Step 03', 'Treatment',  'Συγκεντρωμένη δράση — στοχευμένα συστατικά για κάθε ανάγκη της επιδερμίδας.', 3),
  ('eyes',         'Προϊόντα Ματιών',     'Step 04', 'Eye Care',   'Στοχευμένη φροντίδα για το βλέμμα — ρυτίδες, σακούλες, κούραση.', 4),
  ('moisturizers', 'Κρέμες & Ενυδατικές', 'Step 05', 'Moisturize', 'Σφραγίζει την υγρασία και προστατεύει τον δερματικό φραγμό.', 5),
  ('spf',          'Αντηλιακά / SPF',     'Step 06', 'Protect',    'Το πιο σημαντικό βήμα anti-aging — καθημερινή προστασία από UV.', 6),
  ('masks',        'Μάσκες Προσώπου',     'Special', 'Weekly',     'Εβδομαδιαία τελετουργικά για βαθιά επανόρθωση και άμεσα ορατά αποτελέσματα.', 7),
  ('body',         'Χέρια & Πόδια',       'Body',    'Smooth',     'Η ομορφιά δεν σταματάει στο πρόσωπο — βαθιά φροντίδα για κάθε σημείο.', 8)
on conflict (id) do update set
  name = excluded.name, step = excluded.step, eyebrow = excluded.eyebrow,
  description = excluded.description, sort_order = excluded.sort_order;

-- ============================================================
-- 3) BRANDS
-- ============================================================
insert into brands (id, name, country) values
  ('anua',             'Anua',             'Korea'),
  ('skin1004',         'SKIN1004',         'Korea'),
  ('holika-holika',    'Holika Holika',    'Korea'),
  ('purederm',         'PUREDERM',         'Korea'),
  ('medicube',         'Medicube',         'Korea'),
  ('cosrx',            'COSRX',            'Korea'),
  ('nine-less',        'NINE LESS',        'Korea'),
  ('celimax',          'CELIMAX',          'Korea'),
  ('axis-y',           'AXIS-Y',           'Korea'),
  ('beauty-of-joseon', 'Beauty of Joseon', 'Korea'),
  ('numbuzin',         'Numbuzin',         'Korea'),
  ('dr-althea',        'Dr. Althea',       'Korea'),
  ('mary-may',         'Mary & May',       'Korea'),
  ('jigott',           'Jigott',           'Korea'),
  ('biodance',         'Biodance',         'Korea'),
  ('skin627',          'SKIN627',          'Korea')
on conflict (id) do update set name = excluded.name, country = excluded.country;

-- ============================================================
-- 4) PRODUCTS  (default_price από category default · stock=50 ως αρχική τιμή)
-- ============================================================

-- ── 01 · CLEANSERS ────────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('cl1', 'Heartleaf Pore Control Cleansing Oil', 'anua', 'cleansers', '200ml',
 'Διπλός καθαρισμός — διαλύει SPF & makeup',
 '10,000 PPM Heartleaf · Non-Comed Oil™',
 'Λάδι καθαρισμού που διαλύει αντηλιακό, makeup και ρύπους χωρίς ξηρότητα και χωρίς να φράζει τους πόρους.',
 'Το διάσημο K-beauty oil cleanser με Non-Comed Oil™ συμπύκνωμα 10,000 PPM heartleaf. Διαλύει αντηλιακό, waterproof makeup και ρύπους της ημέρας μαλακά, ξεπλένεται με νερό σε γαλάκτωμα και αφήνει το δέρμα καθαρό αλλά ενυδατωμένο.',
 'assets/products/anua-heartleaf-pore-control-cleansing-oil-200ml.webp',
 18.90, 50, true, true,
 ARRAY['cruelty-free','vegan','k-beauty','best-seller']),

('cl2', 'Madagascar Centella Poremizing Deep Cleansing Foam', 'skin1004', 'cleansers', '125ml',
 'Βαθύς καθαρισμός για ευαίσθητο δέρμα',
 '100% Centella Asiatica + Γλυκερίνη',
 'Καθαρίζει σε βάθος χωρίς να ξηραίνει — διατηρεί τον δερματικό φραγμό.',
 null,
 'assets/products/A0521AF3-319E-4DB2-8251-0AFB23F247BC_2048x.webp',
 18.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('cl3', 'Heartleaf Quercetinol Pore Deep Cleansing Foam', 'anua', 'cleansers', '150ml',
 'Αποσυμφόρηση πόρων & έλεγχος λιπαρότητας',
 'Heartleaf + Quercetinol',
 'Αποσυμφορώνει βαθιά τους πόρους και ισορροπεί τη λιπαρότητα.',
 null,
 'assets/products/anua-heartleaf-quercetinol-pore-deep-cleansing-foam-150ml-871722.webp',
 18.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('cl4', 'Daily Fresh Rice Cleansing Foam', 'holika-holika', 'cleansers', '150ml',
 'Φωτεινότητα & λάμψη',
 'Εκχύλισμα Ρυζιού + Σαπωνίνες',
 'Καθαρίζει βαθιά τους πόρους και χαρίζει άμεση λάμψη με παραδοσιακό συστατικό.',
 null,
 'assets/products/20240404120730_08ea3389.jpeg',
 18.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ── 02 · TONERS & PADS ────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('t1', 'Heartleaf 77% Soothing Toner', 'anua', 'toners', '250ml',
 'Καταπραϋντικό για ευαίσθητο δέρμα',
 '77% Houttuynia Cordata',
 'Καταπραΰνει, μειώνει κοκκινίλες και ισορροπεί τον δερματικό φραγμό.',
 'Το διάσημο K-beauty toner με 77% εκχύλισμα Houttuynia Cordata. Καταπραΰνει ερεθισμένο δέρμα, ισορροπεί τον φραγμό και ενυδατώνει ελαφρά χωρίς αλκοόλη ή άρωμα.',
 'assets/products/xlarge_20240404120730_260ea86f.jpeg',
 22.90, 50, true, true,
 ARRAY['cruelty-free','vegan','k-beauty','alcohol-free','fragrance-free','viral']),

('t2', 'Madagascar Centella Poremizing Clear Toner', 'skin1004', 'toners', '210ml',
 'Σύσφιξη πόρων & ήπια απολέπιση',
 '4-HAs (AHA · BHA · PHA · LHA) + Pink Mineral Salt',
 'Συνδυασμός 4 ήπιων οξέων και ορυκτών αλάτων που καθαρίζει πόρους και απολεπίζει χωρίς ερεθισμό.',
 null,
 'assets/products/DDAD9E9A-3950-4AD5-893A-38C57AEA5496.webp',
 22.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('t3', 'Azelaic 10 Hyaluron Redness Soothing Pad', 'anua', 'toners', '90 pads',
 'Κατά ακμής & κοκκινίλας',
 '10% Azelaic Acid + Υαλουρονικό',
 'Καταπολεμά ακμή, μειώνει κηλίδες και ενυδατώνει βαθιά.',
 null,
 'assets/products/3824_kopie_3fdd44c3-88cd-46ed-b1c7-c7fbfc80fa38.webp',
 22.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('t4', 'Niacinamide 5 + TXA 2 Brightening Pad', 'anua', 'toners', '60 pads',
 'Λάμψη & μείωση κηλίδων',
 '5% Niacinamide + 2% Τρανεξαμικό Οξύ',
 'Στοχεύει σκούρες κηλίδες, σημάδια ακμής και melasma για ομοιόμορφο τόνο.',
 null,
 'assets/products/Anua_Niacinamide5TXABrighteningPad210ml_3.webp',
 22.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('t5', 'Red Signal Peeling Pads', 'purederm', 'toners', '12 pads',
 'Τριπλή απολέπιση & ανανέωση',
 'AHA · BHA · PHA · LHA',
 'Απομακρύνει νεκρά κύτταρα, καθαρίζει πόρους και ανανεώνει την επιδερμίδα.',
 null,
 'assets/products/purederm-red-signal.jpg',
 22.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('t6', 'Zero Pore Pad 2.0', 'medicube', 'toners', '70 pads',
 'Σύσφιξη πόρων & έλεγχος λιπαρότητας',
 '4.5% AHA (Lactic) + 0.45% BHA (Salicylic)',
 'AHA λειαίνει την υφή ενώ το σαλικυλικό καθαρίζει τους πόρους σε βάθος.',
 null,
 'assets/products/medicube-zero-pore.jpg',
 22.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ── 03 · SERUMS & ESSENCES ────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('s1', 'Advanced Snail 96 Mucin Power Essence', 'cosrx', 'serums', '100ml',
 'Επανόρθωση & βαθιά ενυδάτωση',
 '96% Snail Mucin',
 'Επιταχύνει την ανάπλαση κυττάρων και ομαλοποιεί την υφή.',
 'Το πιο διάσημο K-beauty essence παγκοσμίως. 96% εκχύλισμα σαλιγκαριού που επιδιορθώνει, ενυδατώνει σε βάθος και προετοιμάζει το δέρμα να απορροφήσει τα υπόλοιπα προϊόντα της ρουτίνας. Iconic, με αποδεδειγμένα αποτελέσματα.',
 'assets/products/advanced-snail-96-mucin-power-essence-3419988.webp',
 28.90, 50, true, true,
 ARRAY['cruelty-free','k-beauty','best-seller','viral']),

('s2', 'The 6 Peptide Skin Booster Serum', 'cosrx', 'serums', '150ml',
 'Σύσφιξη & αντιγήρανση',
 '6 Πεπτίδια + Niacinamide',
 'Ενισχύει το κολλαγόνο και βελτιώνει την ελαστικότητα.',
 null,
 'assets/products/6 peptide.webp',
 28.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('s3', 'The Vitamin C 23 Serum', 'cosrx', 'serums', '20ml',
 'Λάμψη & ομοιόμορφος τόνος',
 '23% Καθαρή Βιταμίνη C',
 'Φωτεινότητα, μείωση κηλίδων και προστασία από οξειδωτικό στρες.',
 null,
 'assets/products/c23.webp',
 28.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('s4', 'B-Boost 10% Niacinamide Serum', 'nine-less', 'serums', '30ml',
 'Ισορροπία λιπαρότητας & λάμψη',
 '10% Niacinamide',
 'Ρυθμίζει σμίγμα, μειώνει πόρους και ομοιομορφοποιεί τον τόνο.',
 null,
 'assets/products/b boost 10%.webp',
 28.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('s5', 'The Vita-A Retinal Shot Tightening Booster', 'celimax', 'serums', '15ml',
 'Δυνατή αντιγήρανση & σύσφιξη',
 '0.1% Retinal + 3% Matrixyl',
 'Πιο γρήγορη μορφή ρετινόλης — λειτουργεί 11x ταχύτερα κατά των ρυτίδων.',
 null, null,
 28.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('s6', 'Madagascar Centella Poremizing Fresh Ampoule', 'skin1004', 'serums', '100ml',
 'Σύσφιξη πόρων & ελαστικότητα',
 'Pink Mineral Salt + 9 Peptides + Centella',
 'Καθαρίζει πόρους, βελτιώνει ελαστικότητα — υγρή υφή που δεν κολλάει.',
 null, null,
 28.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('s7', 'Retinol 0.2 Boosting Shot Ampoule', 'skin1004', 'serums', '30ml',
 'Ήπια αντιγήρανση για αρχάριους',
 '0.2% Καθαρή Ρετινόλη',
 'Στοχευμένη δράση κατά ρυτίδων και χαλάρωσης — κατάλληλη για εισαγωγή σε ρετινόλη.',
 null, null,
 28.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('s8', 'Niacinamide 10 Boosting Shot Ampoule', 'skin1004', 'serums', '30ml',
 'Φωτεινότητα & σύσφιξη πόρων',
 '10% Niacinamide',
 'Ομοιόμορφος τόνος, λιγότερες κηλίδες, σφιγμένοι πόροι.',
 null, null,
 28.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('s9', 'Dark Spot Correcting Glow Serum', 'axis-y', 'serums', '50ml',
 'Στόχευση κηλίδων & λάμψη',
 '5% Niacinamide + Squalane + Papaya',
 'Μειώνει σκούρες κηλίδες και χαρίζει λάμψη χωρίς να ερεθίζει.',
 null, null,
 28.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('s10', 'Deep Reviving Bakuchiol + Retinol Serum', 'medicube', 'serums', '30ml',
 'Δυνατή αντιγήρανση 24ώρου',
 'Ενθυλακωμένη Ρετινόλη + Bakuchiol',
 'Συνδυασμός ρετινόλης + φυτικής εναλλακτικής για 24ωρη δράση κατά ρυτίδων.',
 null,
 'assets/products/deep reviving.webp',
 28.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ── 04 · EYE CARE ─────────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('e1', 'Revive Eye Serum Ginseng + Retinal', 'beauty-of-joseon', 'eyes', '30ml',
 'Αντιγήρανση & ενυδάτωση ματιών',
 'Ginseng + Retinal',
 'Μειώνει ρυτίδες, σακούλες και μαύρους κύκλους.',
 'Συνδυάζει το παραδοσιακό κορεάτικο ginseng με σύγχρονη ρετινάλη. Στοχεύει ρυτίδες, σακούλες και κούραση — και ταυτόχρονα ενυδατώνει βαθιά την ευαίσθητη περιοχή των ματιών.',
 'assets/products/revive eye.webp',
 24.90, 50, true, true,
 ARRAY['cruelty-free','k-beauty','best-seller']),

('e2', 'No.9 NAD+ Collagen Under Eye Patches', 'numbuzin', 'eyes', '5 ζευγάρια',
 'Instant glow — ενυδάτωση & σύσφιξη',
 'NAD+ + Marine Collagen + 50 Peptides',
 'Patches που χαρίζουν άμεση φρεσκάδα και μειώνουν σακούλες.',
 null,
 'assets/products/numbuzin.webp',
 24.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('e3', 'Deep Reviving Peptide Eye Cream', 'medicube', 'eyes', '30ml',
 'Lifting ματιών + προσώπου',
 'Πεπτίδια + EGF',
 'Σφίγγει, ενυδατώνει — κατάλληλη και για ολόκληρο το πρόσωπο.',
 null, null,
 24.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ── 05 · MOISTURIZERS ────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('m1', 'Advanced Snail 92 All In One Cream', 'cosrx', 'moisturizers', '100g',
 'Επανόρθωση & βαθιά ενυδάτωση',
 '92% Snail Mucin',
 'Επιδιορθώνει, ενυδατώνει και ομαλοποιεί την υφή — όλα σε ένα βήμα.',
 'Η πιο pure cream της COSRX με 92% εκχύλισμα σαλιγκαριού. Ομαλοποιεί την υφή, ενυδατώνει σε βάθος και επιταχύνει την ανάπλαση. Iconic στο K-beauty κοινό για ευαίσθητο, ξηρό ή στρεσαρισμένο δέρμα.',
 'assets/products/92 snail all in once.webp',
 26.90, 50, true, true,
 ARRAY['cruelty-free','k-beauty','best-seller']),

('m2', '345 Relief Cream', 'dr-althea', 'moisturizers', '50ml',
 'Καταπραϋντική για ευαίσθητο δέρμα',
 '12 ενεργά: Niacinamide + Centella + Ceramide NP',
 '3 για κηλίδες + 4 θρεπτικά + 5 καταπραϋντικά — vegan certified.',
 null,
 'assets/products/Dr.Althea_345_Relief_Cream1.jpg',
 26.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('m3', 'A-Control Azelaic Acid Cream', 'nine-less', 'moisturizers', '50ml',
 'Έλεγχος ακμής & πόρων',
 '10,000 ppm Αζελαϊκό Οξύ + Niacinamide',
 'Μειώνει ακμή, κοκκινίλα και ορατούς πόρους.',
 null,
 'assets/products/NINELESS-a-control-azelaic-acid-cream-hover_1024x1024.webp',
 26.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('m4', 'Madagascar Centella Poremizing Light Gel Cream', 'skin1004', 'moisturizers', '75ml',
 'Ελαφριά υφή — gel για λιπαρό δέρμα',
 'Centella + Hyaluronic',
 'Ενυδατώνει χωρίς να βαραίνει — ιδανική για μικτό ή λιπαρό δέρμα.',
 null,
 'assets/products/Madagascar Centella Poremizing Light Gel Cream.jpeg',
 26.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty']),

('m5', 'Spicule Retinol PDRN Cream', 'mary-may', 'moisturizers', '15g',
 'Αντιγήρανση πολλαπλών επιπέδων',
 '2,000ppm Marine Spicules + 0.1% Retinol + PDRN',
 'Marine spicules μεταφέρουν retinol & PDRN βαθιά για αναζωογόνηση και σύσφιξη πόρων.',
 null, null,
 26.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('m6', 'TXA Niacinamide Capsule Cream', 'medicube', 'moisturizers', '50ml',
 'Λάμψη & ομοιόμορφος τόνος',
 'TXA + Niacinamide Capsules',
 'Capsules με τρανεξαμικό + νιασιναμίδη για στόχευση κηλίδων και melasma.',
 null, null,
 26.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('m7', 'PDRN Pink Collagen Capsule Cream', 'medicube', 'moisturizers', '50ml',
 'Σύσφιξη & επιδιόρθωση',
 'PDRN + Κολλαγόνο',
 'PDRN ενεργοποιεί την παραγωγή κολλαγόνου για σφιχτό δέρμα.',
 null, null,
 26.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('m8', 'Deep Vita C Capsule Cream', 'medicube', 'moisturizers', '50ml',
 'Καθημερινή λάμψη βιταμίνης C',
 'Σταθεροποιημένη Vitamin C Capsules',
 'Δίνει λάμψη και προστασία από οξειδωτικό στρες σε σταθερή μορφή.',
 null, null,
 26.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ── 06 · SPF ──────────────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('sp1', 'Relief Sun Rice + Probiotics SPF50+', 'beauty-of-joseon', 'spf', '50ml',
 'Καθημερινή αντηλιακή προστασία',
 'SPF50+ PA++++ · Rice + Probiotics',
 'Ελαφρύ chemical sunscreen — αόρατο φινίρισμα, χωρίς white cast.',
 'Το πιο αγαπημένο K-beauty αντηλιακό παγκοσμίως. Ελαφριά υφή σαν essence, αόρατο φινίρισμα, υψηλή προστασία SPF50+ PA++++. Προβιοτικά ενυδατώνουν και ηρεμούν — μπορεί να αντικαταστήσει και ενυδατική κρέμα.',
 'assets/products/Relief Sun Rice + Probiotics SPF50+.webp',
 19.90, 50, true, true,
 ARRAY['cruelty-free','vegan','k-beauty','spf-50','best-seller','viral']),

('sp2', 'HYALU-CICA Water-Fit Sun Serum SPF50+ PA++++', 'skin1004', 'spf', '50ml',
 'Ενυδατική προστασία',
 'SPF50+ PA++++ · Cica + Hyaluronic',
 'Water-fit υφή, ενυδάτωση και UV προστασία σε ένα.',
 null,
 'assets/products/HYALU-CICA Water-Fit Sun Serum SPF50+ PA++++.webp',
 19.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty','spf-50']),

('sp3', 'Relief Sun Aqua-Fresh Rice + B5 SPF50+', 'beauty-of-joseon', 'spf', '50ml',
 'Δροσερή mat υφή για λιπαρό δέρμα',
 'SPF50+ PA++++ · Rice + B5',
 'Πιο δροσερή και mat έκδοση του classic Relief Sun.',
 null,
 'assets/products/Relief Sun Aqua-Fresh Rice + B5 SPF50+.webp',
 19.90, 50, true, false,
 ARRAY['cruelty-free','vegan','k-beauty','spf-50']),

('sp4', 'Signature All-In-One B.B Cream SPF50', 'jigott', 'spf', '50ml',
 'BB cream + αντηλιακό σε ένα',
 'SPF50 PA++ · Tinted Coverage',
 'Καλύπτει ατέλειες ενώ προστατεύει από UV.',
 null,
 'assets/products/jigott-sunscreen-cream-jigott-signature-all-in-one-b-b-cream-spf-50-pa-50ml-lolotagr-1200x1200.jpg.webp',
 19.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty','spf-50'])

on conflict (sku) do nothing;

-- ── 07 · MASKS ────────────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('mk1', 'Bio-Collagen Real Deep Mask', 'biodance', 'masks', '4 sheets',
 'Overnight σύσφιξη & ενυδάτωση',
 'Microneedle Collagen Film',
 'Πιο πυκνή hydrogel μάσκα — αφήνεις όλη νύχτα για instant lifting.',
 'Η πιο viral μάσκα του TikTok τα τελευταία χρόνια. Πυκνή hydrogel υφή που κολλάει στο δέρμα, μπορείς να την αφήσεις ακόμα και όλη νύχτα. Το ξύπνημα είναι σαν να μόλις βγήκες από spa: σφιγμένη, λεία, λαμπερή επιδερμίδα.',
 'assets/products/Bio-Collagen Real Deep Mask.webp',
 9.90, 50, true, true,
 ARRAY['cruelty-free','k-beauty','sheet-mask','viral']),

('mk2', 'Refreshing Sea Kelp Real Deep Mask', 'biodance', 'masks', '4 sheets',
 'Καταπράυνση & ενυδάτωση', 'Sea Kelp Hydrogel',
 'Δροσιστική hydrogel μάσκα που ηρεμεί ερεθισμένο δέρμα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk3', 'Radiant Vita-Niacinamide Real Deep Mask', 'biodance', 'masks', '4 sheets',
 'Λάμψη & ομοιόμορφος τόνος', 'Niacinamide + Vitamin Hydrogel',
 'Πυκνή hydrogel μάσκα για άμεση λάμψη και ισορροπία τόνου.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk4', 'Hydro Cera-Nol Real Deep Mask', 'biodance', 'masks', '4 sheets',
 'Επιδιόρθωση δερματικού φραγμού', 'Κεραμίδια + Πανθενόλη',
 'Επανορθωτική μάσκα για ξηρό, ταλαιπωρημένο δέρμα.',
 null, 'assets/products/Hydro Cera-Nol Real Deep Mask.jpg', 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk5', 'Rejuvenating Caviar PDRN Real Deep Mask', 'biodance', 'masks', '4 sheets',
 'Premium αντιγήρανση', 'Χαβιάρι + PDRN',
 'Σύσφιξη, λάμψη, αναζωογόνηση με δύο luxury συστατικά.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk6', 'PDRN Pink Collagen Gel Mask', 'medicube', 'masks', '1 pc',
 'Σύσφιξη με PDRN', 'PDRN + Pink Collagen',
 'Gel μάσκα που σφραγίζει συστατικά και ενεργοποιεί κολλαγόνο.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty']),

('mk7', 'Collagen Lifting Mask', 'medicube', 'masks', '1 pc',
 'Άμεσο lifting effect', 'Κολλαγόνο + Πεπτίδια',
 'Σφίγγει και ορίζει τα περιγράμματα του προσώπου.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty']),

('mk8', 'Collagen Night Wrapping Mask', 'medicube', 'masks', '70ml',
 'Overnight αντιγηραντική θεραπεία', 'Κολλαγόνο Sleeping Mask',
 'Wrapping υφή που σφραγίζει την υγρασία όλη τη νύχτα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty']),

('mk9', 'Zero Pore Blackhead Mud Mask', 'medicube', 'masks', '70ml',
 'Βαθύς καθαρισμός μαύρων στιγμάτων', 'Λάσπη + Σαλικυλικό',
 'Απορροφά λιπαρότητα και τραβάει μαύρα στίγματα από τη μύτη και το πιγούνι.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty']),

('mk10', 'Poremizing Quick Clay Stick Mask', 'skin1004', 'masks', '30g',
 'Stick μάσκα — στοχευμένη', 'Λάσπη + Salt + Centella',
 'Stick που εφαρμόζεται κατευθείαν σε προβληματικές περιοχές.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','vegan','k-beauty']),

('mk11', 'Pure Clean Charcoal Peel Off Mask', 'jigott', 'masks', '180ml',
 'Βαθύς καθαρισμός peel-off', 'Ενεργός Άνθρακας',
 'Peel-off μάσκα που τραβάει ρύπους και νεκρά κύτταρα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty']),

('mk12', 'Caviar Real Ampoule Sheet Mask', 'jigott', 'masks', '1 sheet',
 'Premium αντιγήρανση', 'Εκχύλισμα Χαβιαριού',
 'Πλούσια θρέψη και σύσφιξη με πολυτελές συστατικό.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk13', 'Cucumber Real Ampoule Mask', 'jigott', 'masks', '1 sheet',
 'Δροσιστική καταπραϋντική', 'Εκχύλισμα Αγγουριού',
 'Δροσίζει και ηρεμεί ταλαιπωρημένο δέρμα από ήλιο.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk14', 'Collagen Real Ampoule Sheet Mask', 'jigott', 'masks', '1 sheet',
 'Σύσφιξη & ελαστικότητα', 'Υδρολυμένο Κολλαγόνο',
 'Κάνει το δέρμα πιο σφιχτό και ελαστικό σε μία χρήση.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk15', 'Hyaluronic Acid Real Ampoule Mask', 'jigott', 'masks', '1 sheet',
 'Έντονη ενυδάτωση', 'Υαλουρονικό Οξύ',
 'Plump effect — μετά τη χρήση το δέρμα φαίνεται γεμάτο.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk16', 'Pomegranate Real Ampoule Mask', 'jigott', 'masks', '1 sheet',
 'Αντιοξειδωτική προστασία', 'Εκχύλισμα Ροδιού',
 'Αντιοξειδωτικά για λάμψη και προστασία από στρες περιβάλλοντος.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk17', 'Multi-Vitamin Face Mask', 'jigott', 'masks', '1 sheet',
 'Καθημερινή λάμψη βιταμινών', 'Vitamin Complex',
 'Συνδυασμός βιταμινών για άμεση λάμψη και φρεσκάδα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk18', 'Ceramide with Panthenol Sheet Mask', 'skin627', 'masks', '1 sheet',
 'Επιδιόρθωση φραγμού', 'Κεραμίδια + Πανθενόλη',
 'Ξαναχτίζει τον δερματικό φραγμό σε ευαίσθητο δέρμα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk19', 'Hyaluron with Squalane Sheet Mask', 'skin627', 'masks', '1 sheet',
 'Διπλή ενυδάτωση', 'Υαλουρονικό + Σκουαλάνη',
 'Δύο επίπεδα ενυδάτωσης — επιφάνεια και βάθος.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk20', 'Collagen with Peptide Sheet Mask', 'skin627', 'masks', '1 sheet',
 'Σύσφιξη & αντιγήρανση', 'Κολλαγόνο + Πεπτίδια',
 'Συνδυασμός για άμεσο firming αποτέλεσμα.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk21', 'Retinol with Pearl Sheet Mask', 'skin627', 'masks', '1 sheet',
 'Λάμψη & αντιγήρανση', 'Ρετινόλη + Pearl Extract',
 'Ρετινόλη για ρυτίδες, μαργαριτάρι για λάμψη.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask']),

('mk22', 'Vitamin with Niacinamide Sheet Mask', 'skin627', 'masks', '1 sheet',
 'Φωτεινότητα & ομοιόμορφος τόνος', 'Vitamin C + Niacinamide',
 'Διπλή στόχευση κηλίδων και έντονη λάμψη.',
 null, null, 9.90, 50, true, false, ARRAY['cruelty-free','k-beauty','sheet-mask'])

on conflict (sku) do nothing;

-- ── 08 · BODY ─────────────────────────────────────────────
insert into products (sku, name, brand_id, category_id, size, key_ingredient, tech_name, tech_desc, description, img, default_price, stock, is_active, is_featured, badges) values
('b1', 'Secret Garden Edelweiss Hand Cream', 'jigott', 'body', '100ml',
 'Ενυδατική φροντίδα χεριών',
 'Edelweiss + Σηπτυρεριά',
 'Λεπτή υφή, βαθιά ενυδάτωση, μη λιπαρή.',
 'Κρέμα χεριών με εκχύλισμα Edelweiss — του ορεινού λουλουδιού των Άλπεων που είναι γνωστό για τις αντιοξειδωτικές του ιδιότητες. Λεπτή, μη λιπαρή υφή που απορροφάται γρήγορα και αφήνει τα χέρια απαλά για ώρες.',
 'assets/products/Secret Garden Edelweiss Hand Cream.webp',
 14.90, 50, true, true,
 ARRAY['cruelty-free','k-beauty']),

('b2', 'Heating Moisture Foot Mask', 'purederm', 'body', '1 pair',
 'Θερμαντική θεραπεία ποδιών',
 'Self-Heating Activation',
 'Self-heating μάσκα που ενυδατώνει και χαλαρώνει κουρασμένα πόδια.',
 null,
 'assets/products/PUREDERM_PD_Heating_Moisture_Foot_Mask_1_pair.webp',
 14.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty']),

('b3', 'Crystal Nose Pore Strips', 'purederm', 'body', '6 strips',
 'Καθαρισμός μαύρων στιγμάτων μύτης',
 'Adhesive Pore Strips',
 'Καθαρίζουν μηχανικά τους πόρους της μύτης από μαύρα στίγματα.',
 null,
 'assets/products/Crystal Nose Pore Strips.jpg',
 14.90, 50, true, false,
 ARRAY['cruelty-free','k-beauty'])

on conflict (sku) do nothing;

-- ============================================================
-- Επιβεβαίωση — δες πόσα φτιάχτηκαν
-- ============================================================
select 'categories' as table_name, count(*) from categories
union all
select 'brands',     count(*) from brands
union all
select 'products',   count(*) from products;
