# Viva Wallet — Πληρωμή με κάρτα (Smart Checkout)

Δύο edge functions:

| Function | Ρόλος |
|---|---|
| `create-viva-payment` | Δημιουργεί payment order στη Viva και επιστρέφει `checkout_url` (το frontend κάνει redirect). |
| `viva-webhook` | Λαμβάνει το επιτυχές payment event της Viva και σημειώνει `paid_at` στην παραγγελία. |

## ⚠️ Δεν δουλεύει χωρίς λογαριασμό Viva
Χρειάζεσαι **Viva Wallet merchant account** και τα παρακάτω credentials. Μέχρι να τα ορίσεις, το frontend πέφτει αυτόματα σε fallback: η παραγγελία καταχωρείται ως `pending` και ο πελάτης βλέπει σχετικό μήνυμα.

## 1) Πάρε τα credentials από το Viva
- **Smart Checkout credentials** (Client ID + Client Secret): Viva → Settings → API Access → *Smart Checkout Credentials*.
- **Source Code**: Viva → Sales → Payment Sources (ο 4-ψήφιος κωδικός). Όρισε εκεί **Success URL** και **Failure URL**, π.χ.:
  - Success: `https://skinya.gr/#checkout-success`
  - Failure: `https://skinya.gr/#checkout-failure`
- **Merchant ID + API Key**: Viva → Settings → API Access (για το webhook verification).

## 2) Όρισε τα secrets
```bash
supabase secrets set \
  VIVA_CLIENT_ID=xxx \
  VIVA_CLIENT_SECRET=xxx \
  VIVA_SOURCE_CODE=1234 \
  VIVA_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  VIVA_API_KEY=xxxxxxxx \
  VIVA_ENV=demo            # 'demo' για δοκιμές, 'production' για live
```

## 3) Deploy
```bash
supabase functions deploy create-viva-payment          # απαιτεί JWT (το καλεί ο logged-in/anon client)
supabase functions deploy viva-webhook --no-verify-jwt  # η Viva καλεί χωρίς JWT
```

## 4) Καταχώρησε το webhook στη Viva
Viva → Settings → API Access → **Webhooks** → πρόσθεσε:
`https://<project-ref>.functions.supabase.co/viva-webhook`
Η Viva θα κάνει πρώτα ένα GET (verification) — η function απαντά με το `{ "Key": ... }`.

## Ροή
1. Ο πελάτης διαλέγει «Κάρτα» και πατάει «Πληρωμή με κάρτα».
2. Το `submitOrder` δημιουργεί την παραγγελία (`pending`, `payment_method='card'`) και καλεί `create-viva-payment`.
3. Redirect στο Viva Smart Checkout. Ο πελάτης πληρώνει.
4. Η Viva κάνει redirect πίσω (Success/Failure URL) **και** στέλνει webhook.
5. Το `viva-webhook` σημειώνει `paid_at` στην παραγγελία.

> Σημείωση: το webhook θέτει μόνο `paid_at` — το status ροή (pending → shipped) μένει στο admin. Αν θες αυτόματο status `paid`, άλλαξε το update στο `viva-webhook`.
