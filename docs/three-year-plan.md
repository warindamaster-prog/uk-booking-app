# 3-year prepaid package: proposal (awaiting approval)

Status (21 Nov 2026): **migration 0019 was applied to the live database on 21 Nov 2026 (owner approved) and the plan is switched ON (`THREE_YEAR_ENABLED=true`). The Stripe payment itself has NOT been tested with a real card yet.**
The owner accepted all the recommendations below ("ตามที่แนะนำ"). Switching on needs the steps under "Going live" at the end of this file.

Decisions from the owner:

- 35% off is taken from the full **monthly** price times 36 months (not from the yearly price).
- Stripe: do **not** use a Subscription for this. Use a **one-time payment**, and let our own backend track the 3 years, the renewal notices and the end of the term.

## Price

`price = monthly price x 36 x 0.65`, where monthly = £15 + £2 per extra staff member. Minimum 3 staff. VAT 20% on top.

| Staff | Monthly x 36 | 3-year price (ex VAT) | Per month | Incl. VAT |
|---|---|---|---|---|
| 3 | £684.00 | £444.60 | £12.35 | £533.52 |
| 5 | £828.00 | £538.20 | £14.95 | £645.84 |
| 10 | £1,188.00 | £772.20 | £21.45 | £926.64 |

In pence the formula is exact: `monthly_pence * 36 * 65 / 100 = monthly_pence * 234 / 10`, and monthly pence is always a multiple of 100.
For 3 staff the yearly plan x 3 years is £570.00, so the 3-year package is £125.40 (22%) cheaper than yearly and £239.40 (35%) cheaper than monthly.

## How it works (one-time payment)

1. The owner chooses "3-year prepaid" on the plan step of setup (or later on the Billing page). Choosing it during the free trial **does not charge anything**: it records the intent. The free trial runs as normal.
2. The owner pays through a Stripe Checkout page in **payment** mode (one-time, not a subscription), from the Billing page or from a link in the trial reminder emails. The amount, VAT and the term dates are shown before paying. No saved card and no automatic charge later, so no off-session payment can fail on 3-D Secure.
3. When Stripe confirms the payment (webhook `checkout.session.completed`, mode payment), a database function starts the term: status `active`, interval `three_year`, `current_period_end` = payment date + 3 years. It is idempotent on the payment intent id (a repeated webhook changes nothing).
4. Reminder emails 60 and 30 days before the term ends. At the end the booking page closes (same as an ended trial) until the owner buys again or switches to monthly or yearly. The dashboard stays usable.
5. No automatic renewal.

Why not charge at the end of the trial automatically: that needs a saved card and an off-session charge of £533 or more, which can be declined for strong customer authentication and would surprise the owner. Paying on purpose avoids both.

## Database change (migration `supabase/migrations/0019_three_year_prepaid.sql`, not yet applied to the live database)

No new tables. A check constraint widened (plus two new ones: at least 3 staff, no SMS packs), the price and create-business functions updated, `sync_subscription` made to skip prepaid rows, three columns added, two functions added. The first draft is kept below for reference; the real file is the migration (it also carries the latest `sync_subscription` from 0016 and the SMS-pack rules).

```sql
-- 0019_three_year_prepaid.sql (DRAFT)

-- 1) The interval can now be 'three_year'. At least 3 staff for that plan, also for planned reductions.
alter table public.business_billing drop constraint business_billing_billing_interval_check;
alter table public.business_billing add constraint business_billing_billing_interval_check
  check (billing_interval in ('month', 'year', 'three_year'));
alter table public.business_billing add constraint three_year_min_staff
  check (billing_interval <> 'three_year' or (staff_seats >= 3 and coalesce(next_staff_seats, 3) >= 3));

-- 2) What was paid and when (needed for the refund window and for support).
alter table public.business_billing
  add column prepaid_payment_intent_id text unique,
  add column prepaid_paid_at timestamptz,
  add column prepaid_notice_sent_at timestamptz;   -- time of the last renewal notice (like trial_reminder_sent_at)

-- 3) Price: three_year = monthly x 36 x 0.65 (SMS packs are not part of this plan).
create or replace function public.billing_price_pence(p_seats int, p_interval text, p_sms_packs int default 0) returns int
language sql immutable parallel safe set search_path = '' as $$
  select case p_interval
    when 'three_year' then (1500 + 200 * (p_seats - 1)) * 234 / 10
    else (1500 + 200 * (p_seats - 1)) * case p_interval when 'year' then 10 when 'month' then 1 end
       + 500 * coalesce(p_sms_packs, 0) * case p_interval when 'year' then 12 when 'month' then 1 end
  end;
$$;

-- 4) Start the term after the payment is confirmed (service role only, called from the webhook).
create function public.activate_prepaid_term(
  p_business_id uuid, p_payment_intent_id text, p_customer_id text, p_seats int, p_paid_at timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_seats < 3 or p_seats > 50 then raise exception 'seats must be 3 to 50' using errcode = '22023'; end if;
  perform 1 from public.business_billing where business_id = p_business_id for update;
  if not found then raise exception 'billing record not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.business_billing where prepaid_payment_intent_id = p_payment_intent_id) then
    return;   -- the same webhook delivered twice
  end if;
  update public.business_billing set
    status = 'active', billing_interval = 'three_year', staff_seats = p_seats, sms_packs = 0, sms_enabled = false,
    current_price_pence = public.billing_price_pence(p_seats, 'three_year'),
    next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null,
    current_period_end = p_paid_at + interval '3 years',
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    stripe_subscription_id = null,
    prepaid_payment_intent_id = p_payment_intent_id, prepaid_paid_at = p_paid_at, prepaid_notice_sent_at = null
  where business_id = p_business_id;
end $$;
revoke all on function public.activate_prepaid_term(uuid, text, text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_prepaid_term(uuid, text, text, int, timestamptz) to service_role;

-- 5) End of term: close prepaid businesses whose three years are over (called by the cron job).
create function public.expire_prepaid_terms() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with u as (
    update public.business_billing set status = 'canceled'
    where billing_interval = 'three_year' and status = 'active' and stripe_subscription_id is null
      and current_period_end <= now()
    returning 1)
  select count(*)::int into n from u;
  return n;
end $$;
revoke all on function public.expire_prepaid_terms() from public, anon, authenticated;
grant execute on function public.expire_prepaid_terms() to service_role;
```

Existing rows are untouched (all current rows are `month` or `year`).
The existing functions that assume a Stripe subscription (`sync_subscription`, the seat-increase and seat-reduction functions, the cancel flow) must **refuse or skip** `three_year` rows. That is application-code work, listed below, and needs tests.

## Application work (after approval)

- `pricing.ts`: `three_year` interval, 36 x 0.65, minimum 3 staff, and the test that checks it agrees with the SQL function for every seat count.
- Setup page, step 2: a third plan card "3-year prepaid" (shown only with 3 or more staff; the staff-count question stays above it) with price, VAT and "you pay once, no renewal".
- Billing page: "Pay for your 3-year plan" button (Checkout, payment mode), term dates once paid, and the clear refund text.
- Webhook: handle the paid Checkout Session, check the amount against `billing_price_pence`, call `activate_prepaid_term`. Verify signature, idempotent, never trust the amount from the browser.
- Cron: `expire_prepaid_terms()`; renewal notices at 60 and 30 days; the trial reminder emails mention the 3-year amount when that is the chosen plan.
- Block the seat and SMS pack changes that do not apply (see questions).
- Landing page pricing text. Thai strings.

## Still to decide (my recommendations; nothing is built on them yet)

1. **Adding staff during the term.** Recommended: allowed, as a one-time top-up for the months left at the same 35% off. Phase 2 (until then: "contact us").
2. **Removing staff.** No refund; never below 3 paid staff.
3. **Cancel and refund.** Recommended: full refund within 14 days of payment, none after, except where the law requires. The text must be shown before paying. **Have a solicitor or accountant read it before selling.**
4. **After 3 years.** No automatic renewal; notices at 60 and 30 days.
5. **SMS packs.** Not part of the plan (SMS is off).
6. **Price lock.** The price is fixed for the 3 years; say so in the terms.
7. **When to open sale.** Hide it behind a switch until the brand and domain are final (planned Feb 2027), because a 3-year commitment on a domain that may change is a risk.
8. **Accounting.** Three years paid in advance is deferred income, and VAT is usually due when the money is received. Ask the accountant.
9. **Stripe fees.** One large card payment pays the usual percentage fee once; check the real figure in Stripe.
10. **Term start.** Recommended: from the payment date (a few remaining trial days are not added on top).

## What was built (all behind `THREE_YEAR_ENABLED`, default off)

- `src/lib/pricing.ts`: `PlanInterval` (`month | year | three_year`), the 3-year price, savings helpers. `BillingInterval` is unchanged on purpose: the subscription code (seat changes, SMS packs) never sees `three_year`.
- Migration 0019 and `supabase/tests/schema.test.ts`: price twin test for 3 to 50 staff, constraints, activation (idempotent), end of term, and that subscription events never overwrite a prepaid plan.
- Setup, step 2: a third plan card (greyed out below 3 staff, falls back to monthly if the staff count drops). The server refuses `three_year` while the switch is off.
- Billing page: for a prepaid shop, the "Pay £X for 3 years" button before paying; term dates after paying; no team-size or SMS forms.
- Stripe: `buildPrepaidCheckoutParams` (one-time payment, price from our formula, 20% VAT, invoice created, metadata tag `prepaid_3y`); the webhook checks the paid amount against the price before it calls `activate_prepaid_term`.
- Cron: `runPrepaidJobs` closes ended terms and sends the 60 and 30 day notices (one column, claim-then-send like the trial emails).
- Seat and SMS changes on a paid prepaid plan are refused ("contact support"). Adding staff during the term (top-up) is not built (phase 2).
- Thai strings for all of the above.

Not built: switching an existing monthly or yearly shop to the 3-year plan (only new sign-ups can choose it, and a shop on a free trial pays from Billing); the top-up for extra staff; refunds are manual through Stripe and support.

## Going live (in this order)

1. Brand and domain final (planned Feb 2027).
2. A solicitor or accountant reads the terms (refund wording above, price lock, VAT on prepayment, deferred income).
3. Apply `0019_three_year_prepaid.sql` to the live database (reviewed and approved by the owner first).
4. Check in Stripe **Sandbox** first: pay a 3-year Checkout with a test card, see the webhook start the term (`3-year plan started`), see the invoice with VAT. Then Live with the smallest case, then a refund.
5. Set `THREE_YEAR_ENABLED=true` in Vercel and redeploy.
6. Put the 3-year price on the landing page pricing section and in the terms.
