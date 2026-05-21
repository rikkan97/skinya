// ============================================================================
// SKINYA · viva-webhook  (Supabase Edge Function, Deno)
// ----------------------------------------------------------------------------
// Λαμβάνει τα webhook events της Viva και σημειώνει την παραγγελία ως πληρωμένη.
//
//   • GET  → επιστρέφει { "Key": "<verification-token>" } (το ζητάει η Viva
//            όταν καταχωρείς/επαληθεύεις το webhook URL).
//   • POST → event. Στο «Transaction Payment Created» (EventTypeId 1796) με
//            StatusId 'F' (finished/success) σημειώνει paid_at στην παραγγελία
//            (αντιστοίχιση μέσω EventData.OrderCode → orders.viva_order_code).
//
// SECRETS:
//   VIVA_MERCHANT_ID          — Merchant ID (για το verification token)
//   VIVA_API_KEY              — API key (για το verification token)
//   VIVA_ENV                  — 'demo' (default) ή 'production'
//   SUPABASE_URL              — αυτόματα διαθέσιμο
//   SUPABASE_SERVICE_ROLE_KEY — αυτόματα διαθέσιμο
//
// Καταχώρηση webhook: Viva dashboard → Settings → API Access → Webhooks,
//   URL = https://<project>.functions.supabase.co/viva-webhook
//   IMPORTANT: deploy με --no-verify-jwt ώστε η Viva να μπορεί να καλεί χωρίς JWT:
//     supabase functions deploy viva-webhook --no-verify-jwt
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VIVA_MERCHANT_ID = Deno.env.get('VIVA_MERCHANT_ID') ?? '';
const VIVA_API_KEY     = Deno.env.get('VIVA_API_KEY') ?? '';
const VIVA_ENV         = (Deno.env.get('VIVA_ENV') ?? 'demo').toLowerCase();
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const IS_PROD = VIVA_ENV === 'production' || VIVA_ENV === 'prod';
const API     = IS_PROD ? 'https://api.vivapayments.com' : 'https://demo-api.vivapayments.com';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Το verification token για το GET handshake
async function getVerificationKey(): Promise<string> {
  const basic = btoa(`${VIVA_MERCHANT_ID}:${VIVA_API_KEY}`);
  const res = await fetch(`${API}/api/messages/config/token`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Viva token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.Key as string;
}

Deno.serve(async (req) => {
  try {
    // 1) Verification handshake
    if (req.method === 'GET') {
      const key = await getVerificationKey();
      return json({ Key: key });
    }

    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const evt = await req.json();
    const data = evt?.EventData ?? evt?.eventData ?? {};
    const orderCode = data.OrderCode ?? data.orderCode;
    const statusId  = data.StatusId  ?? data.statusId;
    const txId      = data.TransactionId ?? data.transactionId;

    // Επιτυχής συναλλαγή = StatusId 'F' (finished)
    if (orderCode && String(statusId).toUpperCase() === 'F') {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: order } = await sb
        .from('orders')
        .select('id, paid_at')
        .eq('viva_order_code', String(orderCode))
        .maybeSingle();

      if (order && !order.paid_at) {
        await sb.from('orders').update({
          paid_at: new Date().toISOString(),
          viva_order_code: txId ? String(txId) : String(orderCode),
        }).eq('id', order.id);

        // Email επιβεβαίωσης πληρωμής (#6 πελάτης + A2 admin) — best-effort
        try {
          await sb.functions.invoke('send-order-email', { body: { type: 'paid', order_id: order.id } });
        } catch (e) {
          console.error('[viva-webhook] paid email failed:', e);
        }
      }
    }

    // Πάντα 200 ώστε να μην ξαναστέλνει η Viva
    return json({ ok: true });
  } catch (err) {
    console.error('[viva-webhook]', err);
    return json({ ok: true });   // 200 ακόμα και σε σφάλμα — αποφεύγουμε retries storm
  }
});
