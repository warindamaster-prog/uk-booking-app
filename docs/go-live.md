# Going live: checklist

Everything below was tested in the Stripe Sandbox first. Do these in order. Nothing here is automatic.

## 0. Decisions made
- Invoices and receipts to shops come from **Stripe only** (the app sends no invoice emails).
- Subscription changes: extra people and SMS packs are charged at once (monthly plan: a full month each; yearly plan: the monthly price for each whole month left until renewal, at most the yearly price). Reductions wait for the next renewal.
- Password reset and sign-up emails are sent from our own mailbox (not Supabase's rate-limited one).

## 1. Accounts and plans
- [ ] Vercel: move from Hobby to **Pro** (Hobby does not allow commercial use).
- [ ] Supabase: move to **Pro** (backups, no pausing).
- [ ] Domain bought and added to Vercel; `NEXT_PUBLIC_SITE_URL` changed to it.
- [ ] Supabase > Authentication > URL configuration: Site URL and Redirect URLs use the new domain (keep the old one until emails sent with it have expired).
- [ ] A sending mailbox that is not a WP mailbox: change `SMTP_*`, `EMAIL_FROM`, `NOTIFY_*` (and keep `EMAIL_CREDENTIALS_KEY`, a copy of it somewhere safe).

## 2. Stripe: switch from Sandbox to Live
The live account's ids and secrets are different from the sandbox ones. Mixing them is the most common mistake (it caused "does not belong to you" and "Invalid signature" errors in testing).
- [ ] Account activated (company details, bank account, identity).
- [ ] Connect > Settings: **Platform**; Onboarding options > OAuth: enable OAuth for Standard accounts; redirect URI `<site>/api/stripe/connect/callback` (add the new domain's too). Copy the **live client ID** (`ca_...`).
- [ ] Developers > Webhooks, **two** destinations, both to `<site>/api/stripe/webhook`, payload style Snapshot:
  - Events from **Your account**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Events from **Connected accounts**: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
  - Each has its own signing secret (`whsec_...`): the Your account one is `STRIPE_WEBHOOK_SECRET`, the Connected one is `STRIPE_CONNECT_WEBHOOK_SECRET`. Check which is which in the destination's own page.
- [ ] Create the live prices and VAT rate with the live key: `npm run stripe:setup` (on a network behind an HTTP proxy add `STRIPE_USE_FETCH=1`). It prints `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_SMS_MONTHLY`, `STRIPE_PRICE_SMS_YEARLY`, `STRIPE_VAT_TAX_RATE_ID`.
- [ ] Vercel (Production) set: `STRIPE_SECRET_KEY` (`sk_live_...`), `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, the five ids above. Redeploy.
- [ ] Stripe > Settings > Billing > **Customer portal**: activate (it is separate in live mode).
- [ ] Stripe > Settings > **Customer emails**: successful payments (receipts) and refunds on. Settings > Billing > Subscriptions and emails: finalised invoices and upcoming renewals on.
- [ ] Stripe > Settings > Business: company name, address and **VAT registration number**, so invoices can be used as VAT invoices. Look at a sample invoice.

## 3. Clean up test data and test switches
- [ ] Delete the demo and test businesses (their Stripe ids are test-mode ids and will not work live). See "Deleting a business" below.
- [ ] Remove `BILLING_SKIP_TRIAL` from Vercel (it takes the first payment at once and ends the free trial for new shops). Decide: free 60 days (leave it out, set `BILLING_ENABLED=true`) or pay at sign-up.
- [ ] `EMAIL_OVERRIDE_TO` empty (it redirects every email to one address).
- [ ] GitHub Actions: secrets `CRON_SECRET` (same as Vercel) and `APP_URL` set; the "reminders" workflow runs green every 15 minutes.

## 4. SMS
Decided: SMS is switched **off** for the two-month trial period. No text is sent yet (no provider connected), so the option is hidden (sign-up and Billing) and cannot be bought while `SMS_PACKS_ENABLED` is not `true` (it is unset in Vercel, which means off). Shops that already hold packs (test shops) keep them but cannot change them. To switch it on later: connect Twilio, make the sending code respect the pack count, then set `SMS_PACKS_ENABLED=true`.

## 5. Test once with real money (small amounts)
- [ ] A shop connects its real Stripe account; a £1 deposit service is booked and paid with a real card; the booking is confirmed; the deposit is refunded with "Refund deposit".
- [ ] A shop subscribes (smallest plan); the Billing page turns active by itself; add a person (charged at once); cancel in the customer portal.
- [ ] The confirmation, reminder and cancellation emails arrive (check the junk folder too), and a password reset email works from an Outlook address.

## Deleting a business
Delete its bookings first (they block the delete), then the business (the rest cascades), then the login user if wanted:
`delete from bookings where business_id = ...; delete from businesses where id = ...; delete from auth.users where id = ...;`
