# Showing up in Google

Status (21 Nov 2026): basics done. Domain `getitbook.com` is verified in Google Search Console (TXT record at Vercel DNS: keep it, or verification is lost).

## What is in the site
- `robots.txt` (`src/app/robots.ts`): on `getitbook.com` it allows the landing page and privacy notice and blocks the dashboard, API, auth, sign-in, sign-up and `/b/` pages. On any other host (a shop's sub-domain, previews) it blocks everything.
- `sitemap.xml` (`src/app/sitemap.ts`): the landing page and the privacy notice.
- Page title, description, canonical address and share card (Open Graph and Twitter) in `src/app/layout.tsx`; the share picture is `src/app/opengraph-image.tsx`.
- JSON-LD (`SoftwareApplication`, price from the real price formula) on the landing page.
- `noindex` on the dashboard, sign-in, sign-up, password and set-up pages, and on every shop booking page (`src/app/b/[slug]/layout.tsx`).

## Shops in Google: off for now
Shop booking pages (`shop.getitbook.com`) are not indexed while only test shops exist. To allow it later: remove the `robots` line in `src/app/b/[slug]/layout.tsx`, let `robots.ts` allow shop sub-domains and list them in `sitemap.ts` (read the shops from the database).

## What the owner does in Search Console
1. Sitemaps: add `sitemap.xml`.
2. URL Inspection: `https://getitbook.com` then "Request indexing".
3. Wait: a new site takes days to weeks. Check Pages and Performance after a week.

## Reality check
- "getitbook" collides with other things (a book by Troy Ritchie, GetItBooks on Amazon, GitBook), so the name alone will not rank soon. Realistic targets are phrases like "online booking software UK" and "booking system for massage / beauty / wellness businesses".
- What moves the ranking most: other sites linking to us (LinkedIn and Facebook company pages with the link, a Google Business Profile for the company if it has an address, directories), and real pages about the product (how it works, a page per business type, FAQ, a blog).
