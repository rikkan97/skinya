// ============================================================================
// SKINYA · send-contact  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// Στέλνει το μήνυμα της φόρμας Επικοινωνίας (A4) στο ADMIN_EMAIL μέσω Resend,
// με reply-to τον πελάτη ώστε να απαντάς απευθείας. Προαιρετικό auto-reply.
//
// Input (JSON): { name, email, topic, message, website? }   (website = honeypot)
//
// Secrets: RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL
// Στο Dashboard → Edge Functions → send-contact → Settings: Verify JWT = OFF
// (η φόρμα είναι public — καλείται με anon key).
// ============================================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') ?? 'Skinya <onboarding@resend.dev>';
const ADMIN_EMAIL     = Deno.env.get('ADMIN_EMAIL') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

async function sendViaResend(payload: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, ...payload }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY δεν έχει οριστεί');
    if (!ADMIN_EMAIL)    throw new Error('ADMIN_EMAIL δεν έχει οριστεί');

    const { name, email, topic, message, website } = await req.json();

    // Honeypot — bots γεμίζουν το κρυφό πεδίο "website"
    if (website) return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'MISSING_FIELDS' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return new Response(JSON.stringify({ error: 'INVALID_EMAIL' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
          <tr><td style="background:#2e231d;padding:14px 24px"><span style="color:#fff;font-size:13px;letter-spacing:.14em;font-weight:700">SKINYA · ΕΠΙΚΟΙΝΩΝΙΑ</span></td></tr>
          <tr><td style="padding:24px">
            <h1 style="margin:0 0 14px;font-size:18px;color:#1c1a18">✉️ Νέο μήνυμα${topic ? ` · ${esc(topic)}` : ''}</h1>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f6;border-radius:10px"><tr><td style="padding:14px 18px">
              <p style="margin:0 0 6px;color:#1c1a18"><strong>${esc(name)}</strong></p>
              <p style="margin:0 0 12px"><a href="mailto:${esc(email)}" style="color:#7a5;text-decoration:none">${esc(email)}</a></p>
              <p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#4a443e">${esc(message)}</p>
            </td></tr></table>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    await sendViaResend({
      to: ADMIN_EMAIL,
      reply_to: String(email),
      subject: `✉️ Επικοινωνία${topic ? ` · ${topic}` : ''} — ${name}`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[send-contact]', err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
