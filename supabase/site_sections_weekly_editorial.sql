-- ============================================================
-- SKINYA · Weekly editorial copy (config.editorial + config.cards)
-- Προ-γεμίζει το weekly_routine με τα τρέχοντα (default) κείμενα:
--   • editorial → το μεγάλο hero (1ο προϊόν)
--   • cards[0]  → η κάρτα 2 (2ο προϊόν)
--   • cards[1]  → η κάρτα 3 (3ο προϊόν)
-- Έτσι στο admin εμφανίζονται ήδη συμπληρωμένα και απλώς τα
-- επεξεργάζεσαι όταν αλλάζεις τα weekly προϊόντα.
-- Run στο Supabase SQL Editor. Idempotent (δεν ξαναγράφει αν υπάρχει).
-- ============================================================

update public.site_sections
  set config = coalesce(config, '{}'::jsonb)
    || jsonb_build_object('editorial', jsonb_build_object(
        'tag',     'Overnight Mask',
        'time',    '15'' ή όλη νύχτα',
        'bestFor', 'αφυδάτωση · έλλειψη λάμψης',
        'title',   'Hydrogel μάσκα,',
        'titleEm', 'η νύχτα που αλλάζει το δέρμα.',
        'lead',    'Microneedle collagen film που λιώνει στο δέρμα. Μετά τον καθαρισμό & τον toner — 15-20 λεπτά αν βιάζεσαι, ή όλη νύχτα για deep results.',
        'result',  'Πλήρης ενυδάτωση · ορατή λάμψη το επόμενο πρωί · σφιχτή υφή σε εβδομάδες.',
        'chips',   'Marine Collagen, Microneedle Film, Hydrogel',
        'why',     'η viral TikTok μάσκα που πραγματικά αξίζει — collagen που απορροφάται, όχι sheet που στεγνώνει.'
      ))
    || jsonb_build_object('cards', jsonb_build_array(
        jsonb_build_object(
          'step',    'Clay',
          'time',    '10''',
          'title',   'Βαθύς καθαρισμός',
          'titleEm', 'πόρων.',
          'result',  'Για μαύρα στίγματα στη μύτη και πιγούνι — η λάσπη τα τραβάει χωρίς να ξηραίνει.',
          'chips',   'Mud Clay, Σαλικυλικό',
          'why',     'ορατά αποτελέσματα από την πρώτη χρήση.'
        ),
        jsonb_build_object(
          'step',    'Eye',
          'time',    '10-15''',
          'title',   'Patches για',
          'titleEm', 'instant glow.',
          'result',  '10-15'' πριν από κάθε σημαντικό event — άμεση φρεσκάδα, μειωμένες σακούλες.',
          'chips',   'NAD+, 50 Peptides',
          'why',     'τεχνολογία επιστημονικού επιπέδου σε patch.'
        )
      ))
  where id = 'weekly_routine'
    and not (config ? 'editorial');

select id, config from public.site_sections where id = 'weekly_routine';
