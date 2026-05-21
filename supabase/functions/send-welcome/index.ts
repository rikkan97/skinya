// ============================================================================
// SKINYA · send-welcome  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// Welcome email (#11) μετά την εγγραφή — απλό καλωσόρισμα.
//
// Input (JSON): { email, name? }
// Secrets: RESEND_API_KEY, EMAIL_FROM, SITE_URL?
// Settings: Verify JWT = OFF (καλείται με anon key μετά το signUp).
// ============================================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') ?? 'Skinya <onboarding@resend.dev>';
const SITE_URL        = Deno.env.get('SITE_URL') ?? 'https://skinya.gr';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY δεν έχει οριστεί');
    const { email, name } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'MISSING_EMAIL' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const first = String(name || '').trim().split(/\s+/)[0];
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:32px 12px"><tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)">
          <tr><td style="background:#1c1a18;padding:26px 32px;text-align:center"><span style="color:#fff;font-size:22px;letter-spacing:.18em;font-weight:600">SKINYA</span></td></tr>
          <tr><td style="padding:32px">
            <h1 style="margin:0 0 16px;font-size:22px;color:#1c1a18">Καλώς ήρθες${first ? `, ${esc(first)}` : ''} ❀</h1>
            <p style="margin:0 0 26px;line-height:1.6;color:#4a443e">
              Χαρά μας που είσαι εδώ. Επιλέγουμε αυθεντικό K-Beauty που έχουμε πραγματικά δοκιμάσει — λιγότερα προϊόντα, πιο σωστές επιλογές. Καλή περιήγηση ❀
            </p>
            <p style="margin:0 0 26px;text-align:center">
              <a href="${SITE_URL}" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600">Ξεκίνα τα ψώνια →</a>
            </p>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#faf8f6;color:#9a8f86;font-size:12px;text-align:center;border-top:1px solid #eee">Skinya · Authentic K-Beauty</td></tr>
        </table>
      </td></tr></table></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: email, subject: 'Καλώς ήρθες στη Skinya ❀', html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[send-welcome]', err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
