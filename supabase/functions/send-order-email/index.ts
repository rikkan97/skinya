// ============================================================================
// SKINYA · send-order-email  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// Στέλνει transactional emails μέσω Resend για κάθε στάδιο μιας παραγγελίας:
//   • type: 'received'  → «Λάβαμε την παραγγελία σου» (+ οδηγίες κατάθεσης αν bank_transfer)
//                          ΚΑΙ admin «Νέα παραγγελία» (A1)
//   • type: 'paid'      → «Η πληρωμή σου επιβεβαιώθηκε» (από viva-webhook)
//                          ΚΑΙ admin «Πληρώθηκε» (A2)
//   • type: 'shipped'   → «Στάλθηκε με <μεταφορική> #<tracking>» (από το admin)
//   • type: 'cancelled' → «Η παραγγελία σου ακυρώθηκε» (από το admin)
//
// Input (JSON):  { "type": "received"|"paid"|"shipped"|"cancelled", "order_id": "<uuid>" }
//
// Secrets που πρέπει να οριστούν (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY            — το API key του Resend
//   EMAIL_FROM                — π.χ. "Skinya <orders@skinya.gr>"  (test: onboarding@resend.dev)
//   ADMIN_EMAIL               — (προαιρετικό) π.χ. orders@skinya.gr για τα internal A1/A2
//   ADMIN_URL                 — (προαιρετικό) π.χ. https://admin.skinya.gr για link στο admin email
//   SUPABASE_URL              — αυτόματα διαθέσιμο
//   SUPABASE_SERVICE_ROLE_KEY — αυτόματα διαθέσιμο
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') ?? 'Skinya <onboarding@resend.dev>';
const ADMIN_EMAIL     = Deno.env.get('ADMIN_EMAIL') ?? '';   // π.χ. orders@skinya.gr (internal notifications)
const ADMIN_URL       = Deno.env.get('ADMIN_URL') ?? '';     // π.χ. https://admin.skinya.gr (link στο email)
const SITE_URL        = (Deno.env.get('SITE_URL') ?? 'https://skinya.gr').replace(/\/+$/, '');  // για absolute image URLs
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Μεταφορικές → label + builder του tracking URL (επιβεβαιωμένα patterns, Μάιος 2026).
// ELTA/ACS/Speedex/Γενική → deep-link με τον αριθμό. Courier Center & BOX NOW δεν έχουν
// δημόσιο deep-link → ανοίγει η σελίδα tracking τους (ο αριθμός φαίνεται ήδη στο email).
const CARRIERS: Record<string, { label: string; url: (nr: string) => string }> = {
  elta_courier:   { label: 'ELTA Courier',        url: nr => `https://www.elta-courier.gr/search?br=${encodeURIComponent(nr)}` },
  acs:            { label: 'ACS',                  url: nr => `https://webapp.acscourier.net/track-shipment/${encodeURIComponent(nr)}` },
  speedex:        { label: 'Speedex',              url: nr => `https://speedex.gr/speedex/NewTrackAndTrace.aspx?number=${encodeURIComponent(nr)}` },
  courier_center: { label: 'Courier Center',       url: _nr => `https://www.courier.gr/track` },
  geniki:         { label: 'Γενική Ταχυδρομική',   url: nr => `https://www.taxydromiki.com/track/${encodeURIComponent(nr)}` },
  boxnow:         { label: 'BOX NOW',              url: _nr => `https://boxnow.gr/track` },
};

const fmtMoney = (n: unknown) => `${(Number(n) || 0).toFixed(2)}€`;
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Brand palette
const C = { ink: '#1f1813', gold: '#c0857a', ivory: '#f4e7dc', plum: '#9a584f', card: '#fffdfb', line: '#ecdccd', muted: '#9a8f86', soft: '#6b6058' };
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS  = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Ζεστό «ευχαριστούμε» για το κλείσιμο των customer emails
const thanksLine = `<p style="margin:24px 0 0;text-align:center;font-family:${SERIF};font-style:italic;font-size:19px;color:${C.plum};line-height:1.4">Σ' ευχαριστούμε που μας προτίμησες! 💛<br><span style="font-size:14px;color:${C.muted};font-style:normal">— Η ομάδα της Skinya</span></p>`;

// Απόλυτο URL εικόνας προϊόντος (το snapshot κρατά relative path)
function imgUrl(img: unknown): string {
  const s = String(img || '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `${SITE_URL}/${s.replace(/^\/+/, '')}`;
}

// ── Premium email shell (on-brand, inbox-safe inline styles) ────────────────
function shell(title: string, bodyHtml: string, intro = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap');</style></head>
  <body style="margin:0;background:${C.ivory};font-family:${SANS};color:${C.ink}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory};padding:36px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;box-shadow:0 10px 34px rgba(31,24,19,.10)">
          <tr><td style="background:${C.ink};padding:30px 32px 24px;text-align:center">
            <div style="font-family:${SERIF};font-style:italic;color:#fff;font-size:30px;letter-spacing:.04em;line-height:1">Skinya</div>
            <div style="color:${C.gold};font-size:10px;letter-spacing:.42em;text-transform:uppercase;font-weight:600;margin-top:8px">Authentic K-Beauty</div>
          </td></tr>
          <tr><td style="height:3px;background:${C.gold}"></td></tr>
          <tr><td style="padding:34px 34px 30px">
            <h1 style="margin:0 0 ${intro ? '10' : '18'}px;font-family:${SERIF};font-weight:500;font-size:27px;line-height:1.2;color:${C.ink};letter-spacing:-.01em">${title}</h1>
            ${intro ? `<p style="margin:0 0 22px;line-height:1.65;color:${C.soft};font-size:15px">${intro}</p>` : ''}
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:22px 34px;background:${C.ivory};color:${C.muted};font-size:12px;line-height:1.6;text-align:center;border-top:1px solid ${C.line}">
            <span style="font-family:${SERIF};font-style:italic;font-size:15px;color:${C.plum}">Skinya</span><br>
            Authentic K-Beauty · Για απορίες απάντησε απευθείας σε αυτό το email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function itemsTable(items: any[]): string {
  const rows = (items || []).map(it => {
    const snap = it.product_snapshot || {};
    const url = imgUrl(snap.img);
    const thumb = `<td width="60" style="padding:12px 0;border-bottom:1px solid ${C.line};vertical-align:middle">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:54px;height:54px;background:${C.ivory};border-radius:10px;text-align:center;vertical-align:middle;overflow:hidden">
      ${url ? `<img src="${esc(url)}" width="54" height="54" alt="" style="display:block;width:54px;height:54px;object-fit:cover;border-radius:10px">`
            : `<span style="font-family:${SERIF};font-style:italic;color:${C.gold};font-size:20px;line-height:54px">${esc(String(snap.brand || 'S').charAt(0))}</span>`}
      </td></tr></table></td>`;
    return `<tr>
      ${thumb}
      <td style="padding:12px 0 12px 14px;border-bottom:1px solid ${C.line};vertical-align:middle">
        <strong style="color:${C.ink};font-size:14px">${esc(snap.name || '')}</strong>
        ${snap.brand ? `<span style="color:${C.gold};font-size:12px"> · ${esc(snap.brand)}</span>` : ''}<br>
        <span style="color:${C.muted};font-size:12px">${it.quantity} × ${fmtMoney(it.unit_price)}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;color:${C.ink};font-weight:600;vertical-align:middle">${fmtMoney(it.line_total)}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${rows}</table>`;
}

function totalsBlock(o: any): string {
  const row = (label: string, val: string, strong = false) =>
    `<tr><td style="padding:5px 0;color:${strong ? C.ink : C.soft};font-size:${strong ? '17px' : '14px'};font-family:${strong ? SERIF : SANS};${strong ? 'font-weight:600' : ''}">${label}</td>
     <td style="padding:5px 0;text-align:right;color:${strong ? C.ink : C.soft};font-size:${strong ? '19px' : '14px'};font-family:${strong ? SERIF : SANS};${strong ? 'font-weight:600' : ''}">${val}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:2px solid ${C.gold};padding-top:10px">
    ${row('Υποσύνολο', fmtMoney(o.subtotal))}
    ${row('Μεταφορικά', fmtMoney(o.shipping))}
    ${Number(o.discount) > 0 ? row('Έκπτωση κουπονιού', '-' + fmtMoney(o.discount)) : ''}
    ${Number(o.welcome_discount) > 0 ? row('Έκπτωση 1ης παραγγελίας', '-' + fmtMoney(o.welcome_discount)) : ''}
    ${row('Σύνολο', fmtMoney(o.total), true)}
  </table>`;
}

// Eyebrow + serif αριθμός παραγγελίας
function orderBadge(o: any): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td>
    <div style="color:${C.gold};font-size:10px;letter-spacing:.28em;text-transform:uppercase;font-weight:600;margin-bottom:4px">Αριθμός παραγγελίας</div>
    <div style="font-family:${SERIF};font-style:italic;font-size:24px;color:${C.ink};line-height:1">${esc(o.order_number)}</div>
  </td></tr></table>`;
}

// Block οδηγιών τραπεζικής κατάθεσης (#5) — μπαίνει μέσα στο received email
function bankBlock(o: any, bank: any): string {
  if (o.payment_method !== 'bank_transfer') return '';
  const row = (label: string, val: string) => val
    ? `<tr><td style="padding:3px 0;color:${C.soft};font-size:13px">${label}</td>
         <td style="padding:3px 0;text-align:right;color:${C.ink};font-weight:600;font-size:13px">${esc(val)}</td></tr>`
    : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf1e9;border:1px solid ${C.line};border-radius:12px;margin:6px 0 20px">
      <tr><td style="height:3px;background:${C.gold};border-radius:12px 12px 0 0"></td></tr>
      <tr><td style="padding:18px 20px">
        <p style="margin:0 0 10px;font-family:${SERIF};font-weight:600;font-size:18px;color:${C.ink}">Οδηγίες πληρωμής · Τραπεζική κατάθεση</p>
        <p style="margin:0 0 12px;color:${C.soft};font-size:13px;line-height:1.6">
          Σχεδόν έτοιμα! ❀ Κάνε μια κατάθεση <strong style="color:${C.ink}">${fmtMoney(o.total)}</strong> στον λογαριασμό μας,
          γράφοντας ως <strong style="color:${C.ink}">αιτιολογία τον αριθμό ${esc(o.order_number)}</strong> για να σε βρούμε γρήγορα.
          Μόλις δούμε την κατάθεση, ετοιμάζουμε αμέσως το δέμα σου! 💛
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row('Τράπεζα', bank?.bank_name)}
          ${row('Δικαιούχος', bank?.bank_holder || 'Skinya')}
          ${row('IBAN', bank?.bank_iban)}
          ${row('SWIFT/BIC', bank?.bank_swift)}
        </table>
        ${bank?.bank_note ? `<p style="margin:12px 0 0;color:${C.muted};font-size:12px;line-height:1.5">${esc(bank.bank_note)}</p>` : ''}
      </td></tr>
    </table>`;
}

function receivedHtml(o: any, bank: any): string {
  const addr = o.shipping_address || {};
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ') || '';
  const isBank = o.payment_method === 'bank_transfer';
  const intro = `${name ? esc(name) + ', ε' : 'Ε'}υχαριστούμε για την παραγγελία σου. Την παραλάβαμε και βρίσκεται <strong>υπό επεξεργασία</strong>.${isBank ? ' Ολοκλήρωσε την πληρωμή με τα στοιχεία παρακάτω.' : ' Θα σου στείλουμε νέο email με τον αριθμό αποστολής μόλις φύγει το δέμα.'}`;
  return shell('Λάβαμε την παραγγελία σου ❀', `
    ${orderBadge(o)}
    ${bankBlock(o, bank)}
    ${itemsTable(o.items)}
    ${totalsBlock(o)}
    ${thanksLine}
  `, intro);
}

// #6 — Επιβεβαίωση πληρωμής
function paidHtml(o: any): string {
  return shell('Η πληρωμή σου επιβεβαιώθηκε ✓',
    `${orderBadge(o)}${itemsTable(o.items)}${totalsBlock(o)}${thanksLine}`,
    `Λάβαμε την πληρωμή για την παραγγελία <strong>${esc(o.order_number)}</strong>. Την ετοιμάζουμε για αποστολή — θα ενημερωθείς ξανά μόλις φύγει το δέμα. 💛`);
}

// #8 — Ακύρωση παραγγελίας
function cancelledHtml(o: any): string {
  return shell('Η παραγγελία σου ακυρώθηκε',
    `${orderBadge(o)}${itemsTable(o.items)}${totalsBlock(o)}`,
    `Η παραγγελία <strong>${esc(o.order_number)}</strong> ακυρώθηκε. Αν είχε γίνει πληρωμή, το ποσό επιστρέφεται με τον αρχικό τρόπο πληρωμής εντός λίγων εργάσιμων ημερών. Αν δεν ζήτησες εσύ την ακύρωση, απάντησε σε αυτό το email.`);
}

// ── Admin internal notifications (A1 νέα παραγγελία, A2 πληρωμή) ──────────────
function adminShell(title: string, accent: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2622">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
        <tr><td style="background:${accent};padding:14px 24px"><span style="color:#fff;font-size:13px;letter-spacing:.14em;font-weight:700">SKINYA · ADMIN</span></td></tr>
        <tr><td style="padding:24px"><h1 style="margin:0 0 14px;font-size:18px;color:#1c1a18">${title}</h1>${bodyHtml}</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function adminInfoRows(o: any): string {
  const addr = o.shipping_address || {};
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ') || '—';
  const pm = o.payment_method === 'bank_transfer' ? 'Τραπεζική κατάθεση' : 'Κάρτα (Viva)';
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ');
  const area   = [addr.postcode, addr.city, addr.region].filter(Boolean).join(' · ');
  const row = (l: string, v: string) =>
    `<tr><td style="padding:4px 0;color:#9a8f86;font-size:13px;vertical-align:top">${l}</td><td style="padding:4px 0;text-align:right;color:#1c1a18;font-size:13px;font-weight:600">${v}</td></tr>`;
  const link = ADMIN_URL
    ? `<p style="margin:16px 0 0;text-align:center"><a href="${ADMIN_URL}/#orders" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600;font-size:14px">Άνοιγμα στο admin →</a></p>`
    : `<p style="margin:16px 0 0;color:#9a8f86;font-size:13px;text-align:center">Δες όλα τα στοιχεία & κάνε ενέργειες στο admin panel.</p>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f6;border-radius:10px"><tr><td style="padding:14px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Παραγγελία', esc(o.order_number))}
        ${row('Πελάτης', esc(name))}
        ${row('Email', esc(o.customer_email))}
        ${row('Τηλέφωνο', esc(addr.phone || '—'))}
        ${street ? row('Διεύθυνση', esc(street)) : ''}
        ${area ? row('Περιοχή', esc(area)) : ''}
        ${row('Πληρωμή', pm)}
        ${o.coupon_code ? row('Κουπόνι', esc(o.coupon_code)) : ''}
        ${row('Σύνολο', fmtMoney(o.total))}
        ${o.is_guest ? row('Τύπος', 'Guest') : ''}
      </table>
    </td></tr></table>
    ${o.notes ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#fff7ef;border-radius:8px"><tr><td style="padding:10px 14px;color:#6b6058;font-size:13px;line-height:1.5"><strong style="color:#1c1a18">Σημείωση πελάτη:</strong> ${esc(o.notes)}</td></tr></table>` : ''}
    ${itemsTable(o.items)}
    ${link}`;
}

function adminNewOrderHtml(o: any): string {
  return adminShell(`🛒 Νέα παραγγελία ${esc(o.order_number)}`, '#2e231d', adminInfoRows(o));
}
function adminPaidHtml(o: any): string {
  return adminShell(`💰 Πληρώθηκε ${esc(o.order_number)} — έτοιμη για αποστολή`, '#2f6b4f', adminInfoRows(o));
}

function shippedHtml(o: any): string {
  const c = CARRIERS[o.carrier as string];
  const carrierLabel = c?.label || o.carrier || 'τη μεταφορική';
  const trackUrl = c && o.tracking_number ? c.url(o.tracking_number) : null;
  return shell('Η παραγγελία σου στάλθηκε 📦',
    `${orderBadge(o)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf1e9;border:1px solid ${C.line};border-radius:12px;margin:0 0 ${trackUrl ? '16' : '20'}px">
      <tr><td style="height:3px;background:${C.gold};border-radius:12px 12px 0 0"></td></tr>
      <tr><td style="padding:16px 20px">
        <span style="color:${C.gold};font-size:10px;letter-spacing:.28em;text-transform:uppercase;font-weight:600">Tracking · ${esc(carrierLabel)}</span><br>
        <strong style="font-size:18px;color:${C.ink}">${esc(o.tracking_number || '—')}</strong>
      </td></tr>
    </table>
    ${trackUrl ? `<p style="margin:0 0 22px;text-align:center"><a href="${trackUrl}" style="display:inline-block;background:${C.ink};color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600">Παρακολούθηση δέματος →</a></p>` : ''}
    ${itemsTable(o.items)}
    ${totalsBlock(o)}
    ${thanksLine}
  `, `Η παραγγελία σου στάλθηκε με <strong>${esc(carrierLabel)}</strong>. Μπορείς να την παρακολουθήσεις παρακάτω.`);
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY δεν έχει οριστεί');

    const { type, order_id } = await req.json();
    const TYPES = ['received', 'shipped', 'paid', 'cancelled'];
    if (!TYPES.includes(type) || !order_id) {
      return new Response(JSON.stringify({ error: 'Bad input' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: o, error } = await sb
      .from('orders')
      .select('*, items:order_items(quantity, unit_price, line_total, product_snapshot)')
      .eq('id', order_id)
      .single();
    if (error || !o) throw new Error('Order not found');

    // Dedupe — μη ξαναστείλεις το ίδιο email για την ίδια παραγγελία.
    const SENT_FIELD: Record<string, string> = {
      received:  'received_email_sent_at',
      shipped:   'shipped_email_sent_at',
      paid:      'paid_email_sent_at',
      cancelled: 'cancelled_email_sent_at',
    };
    const sentField = SENT_FIELD[type];
    if (o[sentField]) {
      return new Response(JSON.stringify({ ok: true, skipped: 'already_sent' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const to = o.customer_email;
    if (!to) throw new Error('Order has no customer_email');

    // Για received + τραπεζική κατάθεση → φέρε τα στοιχεία λογαριασμού
    let bank: any = null;
    if (type === 'received' && o.payment_method === 'bank_transfer') {
      const { data: s } = await sb.from('store_settings')
        .select('bank_name, bank_holder, bank_iban, bank_swift, bank_note').eq('id', 1).maybeSingle();
      bank = s || null;
    }

    const SUBJECT: Record<string, string> = {
      received:  `Λάβαμε την παραγγελία σου ${o.order_number} · Skinya`,
      shipped:   `Η παραγγελία σου ${o.order_number} στάλθηκε · Skinya`,
      paid:      `Η πληρωμή σου επιβεβαιώθηκε ${o.order_number} · Skinya`,
      cancelled: `Η παραγγελία σου ${o.order_number} ακυρώθηκε · Skinya`,
    };
    const HTML: Record<string, () => string> = {
      received:  () => receivedHtml(o, bank),
      shipped:   () => shippedHtml(o),
      paid:      () => paidHtml(o),
      cancelled: () => cancelledHtml(o),
    };

    // Customer email — best-effort: αποτυχία ΕΔΩ (π.χ. Resend test mode σε άλλο
    // παραλήπτη) ΔΕΝ πρέπει να μπλοκάρει το admin notification.
    let customerOk = false, customerErr = '';
    try {
      await sendViaResend(to, SUBJECT[type], HTML[type]());
      await sb.from('orders').update({ [sentField]: new Date().toISOString() }).eq('id', order_id);
      customerOk = true;
    } catch (e) {
      customerErr = String((e as Error).message || e);
      console.error('[send-order-email] customer send failed:', customerErr);
    }

    // ── Admin internal notification (ανεξάρτητο από το customer send) ──
    let adminOk = false, adminErr = '';
    if (ADMIN_EMAIL && (type === 'received' || type === 'paid')) {
      try {
        const aSubject = type === 'received'
          ? `🛒 Νέα παραγγελία ${o.order_number} — ${fmtMoney(o.total)}`
          : `💰 Πληρώθηκε ${o.order_number} — ${fmtMoney(o.total)}`;
        const aHtml = type === 'received' ? adminNewOrderHtml(o) : adminPaidHtml(o);
        await sendViaResend(ADMIN_EMAIL, aSubject, aHtml);
        adminOk = true;
      } catch (e) {
        adminErr = String((e as Error).message || e);
        console.error('[send-order-email] admin notify failed:', adminErr);
      }
    }

    return new Response(JSON.stringify({ ok: customerOk || adminOk, customerOk, customerErr, adminOk, adminErr }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[send-order-email]', err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
