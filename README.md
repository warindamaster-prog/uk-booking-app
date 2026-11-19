# Booking app (MVP)

Online booking for UK hair, nails and massage businesses. Flat monthly fee, no per-booking commission.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, RLS, Storage), Stripe, Resend, Vercel.

## Setup

1. `npm install` (Node.js 22 or newer)
2. Create a Supabase project. Apply `supabase/migrations/*.sql` in order (SQL editor, or `supabase db push`).
3. In Supabase Auth settings, add `http://localhost:3000/auth/callback` (and your production URL) to the redirect URLs.
4. `cp .env.example .env.local` and fill in the values (see `.env.example`).
5. `npm run dev` and open http://localhost:3000

## Tests

- `npm test` runs unit tests and the database tests. The database tests apply the real migrations in an in-process Postgres (PGlite) and check the double-booking constraint and RLS isolation. No Supabase project is needed.
- The availability engine lives in `src/lib/availability/` (pure functions). Its tests include a check that every slot it offers is accepted by the database's `no_double_booking` constraint, and every slot it hides is rejected.
- `npm run typecheck`, `npm run lint`

## Deploying to Vercel

Import this repo as a new Vercel project (framework: Next.js, root directory: the repo root). Add the variables from `.env.example` under Project Settings > Environment Variables, and set `NEXT_PUBLIC_SITE_URL` to the production URL.

## Public booking page

Customers book at `/b/<slug>` with no account. Pages that read or write bookings use the Supabase service-role key on the server only (`SUPABASE_SERVICE_ROLE_KEY`). Booking submissions are rate limited (per client address and per email) using the `rate_limits` table. Services with a deposit can't be booked online until Stripe is connected (a later step), so they show a "contact the business" message.

## Plans, trial and billing

- Price: 1 person is £15 per month, each extra person +£2 per month. Yearly is 10 months for the price of 12. All prices are before 20% VAT. The formula lives in `src/lib/pricing.ts` and in the SQL function `billing_price_pence()`; a test checks they agree for every seat count.
- Every business gets a 60-day free trial with no card. While `BILLING_ENABLED=false` (the default) nothing is charged, Stripe is not called, and booking pages stay open even after the trial.
- The number of staff paid for (`business_billing.staff_seats`) is enforced by a database trigger: you cannot have more active staff than seats.
- Seat changes: during the trial they apply immediately. On a paid subscription a reduction is scheduled for the end of the current period (`next_staff_seats`, `next_price_pence`, `change_effective_at`), so this period's price is unchanged and the next one drops.
- Real card billing (Stripe Billing) is a later step.

More sections (Stripe, Resend, cron) are added as those steps land. See `TODO.md` for what is intentionally left for later.
