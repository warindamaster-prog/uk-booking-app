# Shop sub-domains: wp-consulting.getitbook.com

Status (21 Nov 2026): code written and tested, **switched off** (`SHOP_SUBDOMAINS_ENABLED` unset). `*.getitbook.com` is added to the Vercel project, but the DNS and the wildcard certificate are not ready yet.

## How it works
- `src/proxy.ts` calls `routeShopHost()` (`src/lib/shop-host.ts`, tested): on `<shop>.getitbook.com`, `/`, `/book/...` and `/booking/...` are rewritten onto the existing `/b/<shop>/...` pages. Nothing else about the pages changed.
- Old addresses `getitbook.com/b/<shop>/...` are redirected (308) to the sub-domain, keeping the path and query. `/b/<shop>/...` on the shop's own sub-domain is redirected to the clean address.
- Account pages (`/login`, `/dashboard`, `/signup`, `/onboarding`, `/auth` ...) on a sub-domain are redirected to `getitbook.com`: sign-in cookies stay on the main host.
- Links the system builds (confirmation emails, cancel links, Stripe deposit return links, the dashboard "booking link", the sign-up form hint) use `shopUrl()`; links inside the pages use `shopBase()` so they are clean on the sub-domain.
- Reserved names (www, app, api, mail, support, status, admin, login, dashboard ...) are in `RESERVED_SLUGS` (`src/lib/slug.ts`), because a shop name is now also a host name. Existing shop names do not clash.

## Going live
1. DNS at Namecheap (Advanced DNS): add the wildcard record `CNAME *` to `641ffd3a8b0ded1e.vercel-dns-017.com.`
2. Wildcard certificate: Vercel needs to answer the DNS challenge for `*.getitbook.com`. Either delegate `_acme-challenge` to Vercel (NS records `_acme-challenge` to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, no downtime), or move the domain's nameservers to Vercel (then recreate the apex, www and `*` records there first or the site goes down).
3. Check `https://anything.getitbook.com` loads with a padlock.
4. Set `SHOP_SUBDOMAINS_ENABLED=true` in Vercel and redeploy. Test: `klean-me.getitbook.com` shows the shop, `getitbook.com/b/klean-me` redirects to it, a booking, the confirmation email link, the cancel link and a deposit return link work.
5. Only then redirect the old domain `book.wpprecisionsystems.co.uk`.
