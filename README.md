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

More sections (Stripe, Resend, cron) are added as those steps land. See `TODO.md` for what is intentionally left for later.
