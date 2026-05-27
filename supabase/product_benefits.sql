-- ============================================================
-- SKINYA · BENEFITS + TIP fields
-- Προσθήκη πεδίων για το expandable "Βοηθάει" + "Tip" σε κάθε προϊόν.
-- Idempotent — μπορείς να το ξανατρέξεις χωρίς πρόβλημα.
-- Run στο Supabase SQL Editor.
-- ============================================================

alter table products add column if not exists benefits text[] default '{}';
alter table products add column if not exists tip      text;
