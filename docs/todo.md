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

- [x] Code written and tested. Migration 0019 applied to the live database and the plan switched ON on 21 Nov 2026 (owner approved). See `docs/three-year-plan.md`.
- [ ] Still to do: test a real payment (3 staff = £533.52 incl. VAT, then refund), legal and accounting check of the terms, show the 3-year price on the landing page.
- [ ] Phase 2: top-up when adding staff during the term; let existing monthly or yearly shops switch to it.

## Product and design

- [x] **Shop colours** are live (21 Nov 2026): migration `0020_shop_colour.sql` applied and `SHOP_COLORS_ENABLED=true`. Still to check by hand: choose a colour in Settings, see the dashboard and the booking page change. See `docs/shop-colours.md`.

- [ ] **Customer booking page, shop's own look** (hero text, accent colour). Needs two new columns, `description` and `accent_color`, which have not been approved. Write the migration for review first.
- [ ] Optional: Thai for the customer booking pages and emails (only the owner side is Thai now).
- [ ] Optional: skip the "choose a service" step when a shop has just one service; show-password toggle on login.
- [ ] Decide whether to remove the Schedule page from the menu (kept for now: it has week view, staff filter and days off).
- [x] Brand name is now "Get It Book" (logo and page titles; done 21 Nov 2026).

## Brand and domain

- [ ] **Google:** site basics done (robots, sitemap, share card, JSON-LD) and Search Console verified. Owner: submit `sitemap.xml` and request indexing for the home page. Later: allow shop booking pages once real shops want to be found; add more pages (business-type pages, FAQ, blog). See `docs/seo.md`.

- [x] **Shop sub-domains** (`shop.getitbook.com`) are live and tested (21 Nov 2026). DNS is now managed at Vercel (nameservers `ns1/ns2.vercel-dns.com`); the domain is still registered and renewed at Namecheap. See `docs/shop-subdomains.md`.

- [x] Domain `getitbook.com` bought at Namecheap (21 Nov 2026), DNS points to Vercel, `NEXT_PUBLIC_SITE_URL`, Supabase URLs, Stripe Connect redirect URI and both Live webhooks, and the GitHub `APP_URL` secret all moved to it.
- [x] Old domain `book.wpprecisionsystems.co.uk`: no redirect set up (decided 21 Nov 2026: no real shop uses it yet). It still points at the same site, so old links keep working. Revisit if a real shop ever gets customers on old links.
- [ ] **Domain renewal (manual, by the owner's choice):** `getitbook.com` expires 21 Nov 2027 and Auto-Renew is OFF on purpose (the owner will renew by hand with a discount code). Renew in Oct 2027 at the latest, and renew the WithheldforPrivacy protection with it. If it lapses, the whole site goes offline. A reminder is scheduled in the assistant session for 4 Oct 2027; also put one in your own calendar (4 Oct and 1 Nov 2027).
- [x] ICANN email verification done (status ACTIVE, 21 Nov 2026). Auto-Renew was found switched off on 21 Nov: switch it on. Original note: confirm the ICANN email verification for the domain at Namecheap (the yellow ALERT), keep Auto-Renew on and 2-step verification on the Namecheap account.

- [ ] Choose the brand and domain (getitbook.com at Vercel was the recommendation). Then migrate: `NEXT_PUBLIC_SITE_URL`, Supabase redirect URLs, Stripe webhook and Connect redirect URIs, GitHub `APP_URL`, email sender. Per-shop subdomains later.
- [ ] Selling outside the UK needs accountant input (VAT and tax).

## Next week: let Google index each shop's booking page (<shop>.getitbook.com)
- Currently shop booking pages are `noindex` and the sub-domains are not in the sitemap.
- To do: remove noindex on `/b/<shop>` pages (maybe only for shops that opt in), host-aware robots.ts/sitemap for sub-domains (each sub-domain serves its own sitemap), unique title/description per shop, LocalBusiness JSON-LD, canonical to the sub-domain; keep /book/*, /booking/* (cancel/confirm pages) noindex. Add a shop-level "show on Google" switch in Settings.

## Shop front page (built, waiting for migration 0021 + switch)
- Code is pushed with `SHOP_PAGE_ENABLED` off: `<shop>.getitbook.com/` still goes straight to the service list (now at `/services`).
- To switch on: apply `0021_shop_page.sql` (after approval), set `SHOP_PAGE_ENABLED=true` in Vercel, redeploy. Owners then edit it at Settings → Shop page.
