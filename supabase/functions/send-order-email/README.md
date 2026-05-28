# send-order-email — Setup & Deploy

Transactional emails παραγγελίας μέσω **Resend**:
- `received` → «Λάβαμε την παραγγελία σας» (αυτόματα στο checkout)
- `shipped` → «Στάλθηκε με <μεταφορική> #<tracking>» (από το admin)

## 1. Τρέξε το SQL migration
Supabase Dashboard → SQL Editor → τρέξε το `supabase/order_emails.sql`
(προσθέτει `carrier`, `tracking_number`, `received_email_sent_at`, `shipped_email_sent_at`).

## 2. Resend API key
1. https://resend.com → λογαριασμός → **API Keys** → δημιούργησε key.
2. (Αργότερα) Domains → πρόσθεσε `skinya.gr`, βάλε τα DNS records (SPF/DKIM) για να μη πέφτουν spam.
   - Μέχρι να γίνει verified το domain, το test `onboarding@resend.dev` στέλνει **μόνο** στο δικό σου verified email.

## 3. Όρισε τα secrets
Dashboard → Project Settings → **Edge Functions → Secrets** (ή με CLI):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set EMAIL_FROM="Skinya <onboarding@resend.dev>"
# όταν έχεις verified domain, άλλαξε ΜΟΝΟ αυτό:
# supabase secrets set EMAIL_FROM="Skinya <hello@skinya.gr>"
```
(`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` υπάρχουν αυτόματα.)

## 4. Deploy το function
```bash
supabase functions deploy send-order-email
```

## 5. Test
```bash
curl -X POST "https://swkdewwmmxsftdmzjqsr.supabase.co/functions/v1/send-order-email" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"type":"received","order_id":"<ΕΝΑ_ΥΠΑΡΚΤΟ_ORDER_ID>"}'
```

## Σημειώσεις
- **Dedupe:** δεν ξαναστέλνει το ίδιο email — ελέγχει τα `*_email_sent_at`. Στο admin το κουμπί «Επαναποστολή» το παρακάμπτει.
- **Tracking URLs:** στο `index.ts` (map `CARRIERS`) είναι best-effort — επιβεβαίωσέ τα μία φορά με πραγματικό αριθμό ανά μεταφορική.
