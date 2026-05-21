// ============================================================================
// SKINYA · create-viva-payment  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// Δημιουργεί ένα Viva Smart Checkout payment order και επιστρέφει το checkout_url
// στο οποίο γίνεται redirect ο πελάτης για να πληρώσει με κάρτα.
//
// Ροή:
//   1) Παίρνει access token από Viva (OAuth2 client_credentials).
//   2) Δημιουργεί payment order (POST /checkout/v2/orders) → orderCode.
//   3) Αποθηκεύει το orderCode στο orders.viva_order_code.
//   4) Επιστρέφει { checkout_url } → το frontend κάνει redirect.
//
// Input (JSON):  { "order_id": "<uuid>" }
// Output (JSON): { "checkout_url": "https://...", "order_code": 1234567890 }
//
// SECRETS (Dashboard → Edge Functions → Secrets):
//   VIVA_CLIENT_ID            — Smart Checkout client id
//   VIVA_CLIENT_SECRET        — Smart Checkout client secret
//   VIVA_SOURCE_CODE          — ο 4-ψήφιος κωδικός πηγής (payment source)
//   VIVA_ENV                  — 'demo' (default) ή 'production'
//   SUPABASE_URL              — αυτόματα διαθέσιμο
//   SUPABASE_SERVICE_ROLE_KEY — αυτόματα διαθέσιμο
//
// NOTE: Στο Viva dashboard, στο payment source, όρισε τα Success/Failure URLs
//       π.χ.  https://skinya.gr/#checkout-success  /  https://skinya.gr/#checkout-failure
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VIVA_CLIENT_ID     = Deno.env.get('VIVA_CLIENT_ID') ?? '';
const VIVA_CLIENT_SECRET = Deno.env.get('VIVA_CLIENT_SECRET') ?? '';
const VIVA_SOURCE_CODE   = Deno.env.get('VIVA_SOURCE_CODE') ?? '';
const VIVA_ENV           = (Deno.env.get('VIVA_ENV') ?? 'demo').toLowerCase();
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const IS_PROD = VIVA_ENV === 'production' || VIVA_ENV === 'prod';

// Hosts ανά περιβάλλον
const ACCOUNTS = IS_PROD ? 'https://accounts.vivapayments.com' : 'https://demo-accounts.vivapayments.com';
const API      = IS_PROD ? 'https://api.vivapayments.com'      : 'https://demo-api.vivapayments.com';
const CHECKOUT = IS_PROD ? 'https://www.vivapayments.com'      : 'https://demo.vivapayments.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 1) OAuth2 token (client_credentials)
async function getVivaToken(): Promise<string> {
  const basic = btoa(`${VIVA_CLIENT_ID}:${VIVA_CLIENT_SECRET}`);
  const res = await fetch(`${ACCOUNTS}/connect/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Viva token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

// 2) Create payment order → orderCode
async function createVivaOrder(token: string, o: any): Promise<number> {
  const addr = o.shipping_address || {};
  const fullName = [addr.first_name, addr.last_name].filter(Boolean).join(' ') || o.customer_email;
  const body = {
    amount: Math.round(Number(o.total) * 100),  // σε λεπτά
    customerTrns: `Skinya · Παραγγελία ${o.order_number}`,
    customer: {
      email: o.customer_email,
      fullName,
      phone: addr.phone || undefined,
      countryCode: 'GR',
      requestLang: 'el-GR',
    },
    paymentTimeout: 1800,
    preauth: false,
    allowRecurring: false,
    maxInstallments: 0,
    sourceCode: VIVA_SOURCE_CODE,
    merchantTrns: o.order_number,
    tags: ['skinya', o.is_guest ? 'guest' : 'account'],
  };
  const res = await fetch(`${API}/checkout/v2/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Viva order ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.orderCode as number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!VIVA_CLIENT_ID || !VIVA_CLIENT_SECRET || !VIVA_SOURCE_CODE) {
      return json({ error: 'VIVA_NOT_CONFIGURED' }, 503);
    }

    const { order_id } = await req.json();
    if (!order_id) return json({ error: 'order_id required' }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: o, error } = await sb
      .from('orders')
      .select('id, order_number, customer_email, total, shipping_address, is_guest, payment_method')
      .eq('id', order_id)
      .single();
    if (error || !o) throw new Error('Order not found');
    if (o.payment_method !== 'card') return json({ error: 'NOT_A_CARD_ORDER' }, 400);

    const token     = await getVivaToken();
    const orderCode = await createVivaOrder(token, o);

    // Αποθήκευσε το orderCode για αντιστοίχιση στο webhook
    await sb.from('orders').update({ viva_order_code: String(orderCode) }).eq('id', order_id);

    return json({
      checkout_url: `${CHECKOUT}/web/checkout?ref=${orderCode}`,
      order_code: orderCode,
    });
  } catch (err) {
    console.error('[create-viva-payment]', err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
