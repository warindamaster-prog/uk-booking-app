# To do (not started)

Notes written 21 Nov 2026. Nothing here has been done yet unless it says so.

## Keep the system running reliably

- [ ] **Reliable scheduler.** GitHub's scheduled run fired only about every 3 to 8 hours (6 runs in 2 days), not every 15 minutes. Trial emails and reminders can arrive hours late. Plan: cron-job.org calls `/api/cron/reminders` every 5 minutes with the `CRON_SECRET` header (the owner types the secret into cron-job.org, never in chat). Keep GitHub as the backup. Not started: the owner said "not yet".
- [ ] **Klean Me "trial ended" email** was never sent in the 21 Nov test because of the scheduler gap above. The trial has since been restored (ends 19 Jan 2027), so this only needs re-testing with a test shop whose trial is set to end soon.
- [x] **Keep Supabase from pausing (done 21 Nov 2026: `/api/health` and `.github/workflows/keepalive.yml`; see `docs/backup.md`; still to check: that the first keepalive runs are green).** Original note: keep Supabase from pausing (Free plan pauses after about 1 week of no activity).** The cron already reads the database, which probably counts. To be sure, add a light `/api/health` endpoint (one trivial query, creates no data) and have the scheduler call it every 6 days. Do not use test bookings: they create fake customers and may send emails.
- [ ] **Weekly database backup (scripts written 21 Nov 2026 in `scripts/backup.ps1` and `scripts/backup.sh`; steps in `docs/backup.md`; still to do by the owner: install pg_dump, set up the Task Scheduler job, test one restore).** Original note, now changed: do not use GitHub artifacts because the repo is public. Weekly database backup (no automatic backups on Free).** A GitHub Actions workflow every 7 days runs `pg_dump`, encrypts the file (it holds customer personal data) and stores it as a private artifact. Download a copy to the owner's computer now and then. The database password goes into GitHub Secrets, entered by the owner. Alternative: Windows Task Scheduler running `pg_dump` on the owner's computer.
- [ ] **Supabase stays on Free for now (decided 21 Nov 2026).** The pause is covered by the `/api/health` call and the cron, and data loss by the weekly encrypted backup. Revisit when about 3 shops pay, or when losing up to 7 days of data (the gap between backups) is no longer acceptable. Pro would add daily backups and one-click restore.
- [ ] **Vercel Pro: buy when the first customer pays (decided 21 Nov 2026).** The Hobby plan is for non-commercial use. Before then, stay on Hobby.

## Money

- [ ] **Test deposit and refund in Live.** Sandbox is already proven: two £10 refunds succeeded on the test shop "nailed-it". Live is not tested. Needs a shop with its own Stripe account (not the platform account), connected on the Payments page, then a £1 deposit with a real card, then cancel and refund both ways (customer cancels in time, owner presses Refund deposit). Check the Live Connect webhook has the refund events.
- [ ] **Real £18 subscription test** (set `BILLING_SKIP_TRIAL` temporarily, then turn it off).
- [ ] Put the VAT number in Stripe settings (invoices), and check customer portal and email settings.
- [ ] First friendly shop to test Connect and a £1 deposit.

## Email

- [ ] Check SPF, DKIM and DMARC of system emails (use "Show original" in desktop Gmail, or mail-tester).
- [ ] Set `SUPPORT_EMAIL` (support messages) and use a non-WP sender address; consider Resend.

## 3-year prepaid package

- [x] Code written and tested, switched off (`THREE_YEAR_ENABLED=false`). Migration 0019 is in the repo but NOT applied to the live database. See `docs/three-year-plan.md` ("Going live").
- [ ] Owner approves and applies migration 0019; test the Stripe payment in Sandbox; legal and accounting check; then switch on after the brand and domain are final.
- [ ] Phase 2: top-up when adding staff during the term; let existing monthly or yearly shops switch to it.

## Product and design

- [ ] **Customer booking page, shop's own look** (hero text, accent colour). Needs two new columns, `description` and `accent_color`, which have not been approved. Write the migration for review first.
- [ ] Optional: Thai for the customer booking pages and emails (only the owner side is Thai now).
- [ ] Optional: skip the "choose a service" step when a shop has just one service; show-password toggle on login.
- [ ] Decide whether to remove the Schedule page from the menu (kept for now: it has week view, staff filter and days off).
- [x] Brand name is now "Get It Book" (logo and page titles; done 21 Nov 2026).

## Brand and domain

- [x] Domain `getitbook.com` bought at Namecheap (21 Nov 2026), DNS points to Vercel, `NEXT_PUBLIC_SITE_URL`, Supabase URLs, Stripe Connect redirect URI and both Live webhooks, and the GitHub `APP_URL` secret all moved to it.
- [ ] Redirect the old `book.wpprecisionsystems.co.uk` to `getitbook.com` (keep the old domain for at least a year: customers hold old links). Do it only after a test sign-up on the new domain works.
- [ ] Confirm the ICANN email verification for the domain at Namecheap (the yellow ALERT), keep Auto-Renew on and 2-step verification on the Namecheap account.

- [ ] Choose the brand and domain (getitbook.com at Vercel was the recommendation). Then migrate: `NEXT_PUBLIC_SITE_URL`, Supabase redirect URLs, Stripe webhook and Connect redirect URIs, GitHub `APP_URL`, email sender. Per-shop subdomains later.
- [ ] Selling outside the UK needs accountant input (VAT and tax).
