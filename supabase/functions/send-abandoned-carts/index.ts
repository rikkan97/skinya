// ============================================================================
// SKINYA · send-abandoned-carts  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// #12 — Στέλνει υπενθύμιση για εγκαταλειμμένα καλάθια (μία φορά το καθένα).
// Καλείται από cron (pg_cron → net.http_post). Δες abandoned_cart_cron.sql.
//
// Κριτήρια: reminded_at null, recovered_at null,
//           αδράνεια > IDLE_HOURS (default 4) και < 7 ημέρες.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM, SITE_URL?, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') ?? 'Skinya <onboarding@resend.dev>';
const SITE_URL        = Deno.env.get('SITE_URL') ?? 'https://skinya.gr';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const fmtMoney = (n: unknown) => `${(Number(n) || 0).toFixed(2)}€`;
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function cartHtml(items: any[], subtotal: number): string {
  const rows = (items || []).slice(0, 8).map(i => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f0ece8;color:#1c1a18">
      <strong>${esc(i.name || '')}</strong> <span style="color:#9a8f86">· ${esc(i.brand || '')}</span><br>
      <span style="color:#9a8f86;font-size:12px">${i.qty || 1} τεμ.</span>
    </td>
    <td style="padding:8px 0;border-bottom:1px solid #f0ece8;text-align:right;color:#1c1a18;white-space:nowrap">${fmtMoney((i.price || 0) * (i.qty || 1))}</td>
  </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:32px 12px"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)">
        <tr><td style="background:#1c1a18;padding:26px 32px;text-align:center"><span style="color:#fff;font-size:22px;letter-spacing:.18em;font-weight:600">SKINYA</span></td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 14px;font-size:20px;color:#1c1a18">Ξέχασες κάτι στο καλάθι σου ❀</h1>
          <p style="margin:0 0 18px;line-height:1.6;color:#4a443e">Τα προϊόντα σου σε περιμένουν. Ολοκλήρωσε την παραγγελία πριν εξαντληθούν.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">${rows}</table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1c1a18;margin-top:6px">
            <tr><td style="padding:8px 0;font-weight:700;color:#1c1a18">Υποσύνολο</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;color:#1c1a18">${fmtMoney(subtotal)}</td></tr>
          </table>
          <p style="margin:22px 0 0;text-align:center">
            <a href="${SITE_URL}/?goto=checkout" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600">Ολοκλήρωσε την παραγγελία →</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#faf8f6;color:#9a8f86;font-size:12px;text-align:center;border-top:1px solid #eee">Skinya · Authentic K-Beauty</td></tr>
      </table>
    </td></tr></table></body></html>`;
}

Deno.serve(async () => {
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY δεν έχει οριστεί');
    const IDLE_HOURS = Number(Deno.env.get('IDLE_HOURS') ?? '4');

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const cutoffNew = new Date(Date.now() - IDLE_HOURS * 3600_000).toISOString();
    const cutoffOld = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    const { data: carts, error } = await sb
      .from('abandoned_carts')
      .select('email, items, subtotal, updated_at')
      .is('reminded_at', null)
      .is('recovered_at', null)
      .lt('updated_at', cutoffNew)
      .gt('updated_at', cutoffOld)
      .limit(100);
    if (error) throw error;

    let sent = 0;
    for (const c of carts || []) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: EMAIL_FROM, to: c.email, subject: 'Ξέχασες κάτι στο καλάθι σου ❀ · Skinya', html: cartHtml(c.items as any[], Number(c.subtotal)) }),
        });
        if (!res.ok) { console.error('resend fail', c.email, await res.text()); continue; }
        await sb.from('abandoned_carts').update({ reminded_at: new Date().toISOString() }).eq('email', c.email);
        sent++;
      } catch (e) { console.error('[send-abandoned-carts] row fail', c.email, e); }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[send-abandoned-carts]', err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
