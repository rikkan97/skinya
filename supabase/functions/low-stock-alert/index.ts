// ============================================================================
// SKINYA · low-stock-alert  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// A3 — Ημερήσιο digest στον admin με τα ενεργά προϊόντα που έχουν stock ≤ όριο.
// Καλείται από cron (pg_cron → net.http_post). Δες low_stock_cron.sql.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional query: ?threshold=5
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') ?? 'Skinya <onboarding@resend.dev>';
const ADMIN_EMAIL     = Deno.env.get('ADMIN_EMAIL') ?? '';
const ADMIN_URL       = Deno.env.get('ADMIN_URL') ?? '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

Deno.serve(async (req) => {
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY δεν έχει οριστεί');
    if (!ADMIN_EMAIL)    throw new Error('ADMIN_EMAIL δεν έχει οριστεί');

    const url = new URL(req.url);
    const threshold = Number(url.searchParams.get('threshold') ?? '5');

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: rows, error } = await sb
      .from('products')
      .select('sku, name, stock, category_id')
      .eq('is_active', true)
      .lte('stock', threshold)
      .order('stock', { ascending: true });
    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, low: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    const cell = (v: string, extra = '') => `<td style="padding:9px 10px;border-bottom:1px solid #f0ece8;${extra}">${v}</td>`;
    const tableRows = rows.map(p => {
      const out = Number(p.stock) <= 0;
      return `<tr>
        ${cell(`<strong style="color:#1c1a18">${esc(p.name)}</strong><br><span style="color:#9a8f86;font-size:12px">${esc(p.sku)} · ${esc(p.category_id || '—')}</span>`)}
        ${cell(`<span style="font-weight:700;color:${out ? '#c0392b' : '#b8860b'}">${out ? 'ΕΞΑΝΤΛΗΘΗΚΕ' : p.stock}</span>`, 'text-align:right;white-space:nowrap')}
      </tr>`;
    }).join('');

    const link = ADMIN_URL ? `<p style="margin:18px 0 0;text-align:center"><a href="${ADMIN_URL}/#stock" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600">Διαχείριση stock →</a></p>` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
          <tr><td style="background:#b8860b;padding:14px 24px"><span style="color:#fff;font-size:13px;letter-spacing:.14em;font-weight:700">SKINYA · ADMIN</span></td></tr>
          <tr><td style="padding:24px">
            <h1 style="margin:0 0 6px;font-size:18px;color:#1c1a18">⚠️ Low stock — ${rows.length} προϊόντα ≤ ${threshold}</h1>
            <p style="margin:0 0 16px;color:#9a8f86;font-size:13px">Ενεργά προϊόντα που χρειάζονται αναπλήρωση.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
            ${link}
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject: `⚠️ Low stock — ${rows.length} προϊόντα · Skinya`, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);

    return new Response(JSON.stringify({ ok: true, low: rows.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[low-stock-alert]', err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
