# Skinya · Auth Email Templates (#1, #2)

Αυτά τα δύο **δεν** είναι edge functions — τα διαχειρίζεται το Supabase Auth.
Πήγαινε: **Dashboard → Authentication → Emails → Templates**, διάλεξε το
αντίστοιχο template και κάνε paste το HTML. Κράτα τα `{{ ... }}` variables ως έχουν.

> Tip: στο **Authentication → URL Configuration** βάλε σωστό **Site URL**
> (π.χ. https://skinya.gr) για να δείχνουν σωστά τα links.

---

## #1 · Confirm signup  (template: "Confirm signup")

**Subject:** `Επιβεβαίωσε το email σου · Skinya`

```html
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)">
      <tr><td style="background:#1c1a18;padding:26px 32px;text-align:center"><span style="color:#fff;font-size:22px;letter-spacing:.18em;font-weight:600">SKINYA</span></td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 14px;font-size:20px;color:#1c1a18">Επιβεβαίωσε το email σου</h1>
        <p style="margin:0 0 22px;line-height:1.6;color:#4a443e">Καλώς ήρθες στη Skinya ❀ Πάτησε το κουμπί για να ενεργοποιήσεις τον λογαριασμό σου.</p>
        <p style="margin:0 0 26px;text-align:center">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600">Επιβεβαίωση email →</a>
        </p>
        <p style="margin:0;color:#9a8f86;font-size:12px;line-height:1.5">Αν δεν δημιούργησες εσύ λογαριασμό, αγνόησε αυτό το email.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#faf8f6;color:#9a8f86;font-size:12px;text-align:center;border-top:1px solid #eee">Skinya · Authentic K-Beauty</td></tr>
    </table>
  </td></tr></table>
</body></html>
```

---

## #2 · Reset password  (template: "Reset Password")

**Subject:** `Επαναφορά κωδικού · Skinya`

```html
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2622">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)">
      <tr><td style="background:#1c1a18;padding:26px 32px;text-align:center"><span style="color:#fff;font-size:22px;letter-spacing:.18em;font-weight:600">SKINYA</span></td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 14px;font-size:20px;color:#1c1a18">Επαναφορά κωδικού</h1>
        <p style="margin:0 0 22px;line-height:1.6;color:#4a443e">Ζητήθηκε επαναφορά του κωδικού σου. Πάτησε το κουμπί για να ορίσεις νέο κωδικό.</p>
        <p style="margin:0 0 26px;text-align:center">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1c1a18;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600">Ορισμός νέου κωδικού →</a>
        </p>
        <p style="margin:0;color:#9a8f86;font-size:12px;line-height:1.5">Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#faf8f6;color:#9a8f86;font-size:12px;text-align:center;border-top:1px solid #eee">Skinya · Authentic K-Beauty</td></tr>
    </table>
  </td></tr></table>
</body></html>
```
