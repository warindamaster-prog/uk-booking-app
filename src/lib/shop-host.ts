import { RESERVED_SLUGS, SLUG_RE } from "./slug";

/**
 * Shop sub-domains: each shop's booking page lives at <shop>.getitbook.com. The pages themselves are still the /b/<shop> routes;
 * the proxy rewrites the sub-domain onto them. Off until SHOP_SUBDOMAINS_ENABLED is "true" (needs the wildcard DNS and certificate).
 */
export const shopSubdomainsEnabled = () => process.env.SHOP_SUBDOMAINS_ENABLED === "true";


/**
 * The full address of a shop page, for emails, Stripe return links and the dashboard.
 * With sub-domains on: https://shop.getitbook.com/booking/abc. Off: https://getitbook.com/b/shop/booking/abc.
 */
export function shopUrl(i: { siteUrl: string; slug: string; path?: string; enabled?: boolean }): string {
  const path = i.path ?? "";
  const enabled = i.enabled ?? shopSubdomainsEnabled();
  if (!enabled) return `${i.siteUrl}/b/${i.slug}${path}`;
  const u = new URL(i.siteUrl);
  return `${u.protocol}//${i.slug}.${u.host}${path || ""}`;
}

/** The shop's address without the https://, for showing in the sign-up form. */
export function shopDisplayAddress(i: { siteUrl: string; slug: string; enabled?: boolean }): string {
  return shopUrl(i).replace(/^https?:\/\//, "");
}

export type ShopRoute =
  | { kind: "none" }
  | { kind: "rewrite"; slug: string; path: string }
  | { kind: "redirect"; url: string };

// Pages that belong to the main site: on a shop's sub-domain they are sent to the main address.
const MAIN_SITE = /^\/(login|signup|dashboard|onboarding|forgot-password|reset-password|auth|admin)(\/|$)/;
const SHOP_PATH = /^\/b\/([a-z0-9-]+)(\/.*)?$/;

/**
 * What the proxy does with a request, given its host and path. Pure, so it can be tested.
 * - Main site (getitbook.com): an old /b/<shop>/... address is sent on to <shop>.getitbook.com/... (308).
 * - A shop's sub-domain: /, /services and /book/..., /booking/... show that shop (rewrite onto /b/<shop>/...);
 *   /b/<this shop>/... is sent to the clean address; the account pages are sent to the main site.
 * - Any other host (previews, localhost, the old domain) and anything else: untouched.
 */
export function routeShopHost(i: { host: string; path: string; search?: string; siteUrl: string; enabled: boolean }): ShopRoute {
  if (!i.enabled) return { kind: "none" };
  const host = i.host.toLowerCase().replace(/:\d+$/, "");
  const site = new URL(i.siteUrl);
  const root = site.hostname.toLowerCase();
  const search = i.search ?? "";
  const proto = site.protocol;

  if (host === root || host === `www.${root}`) {
    const m = SHOP_PATH.exec(i.path);
    if (m && SLUG_RE.test(m[1]) && !RESERVED_SLUGS.has(m[1])) {
      return { kind: "redirect", url: `${proto}//${m[1]}.${site.host}${m[2] && m[2] !== "/" ? m[2] : ""}${search}` };
    }
    return { kind: "none" };
  }

  if (!host.endsWith(`.${root}`)) return { kind: "none" };
  const label = host.slice(0, -(root.length + 1));
  if (label.includes(".") || !SLUG_RE.test(label) || RESERVED_SLUGS.has(label)) return { kind: "none" };

  const own = SHOP_PATH.exec(i.path);
  if (own && own[1] === label) return { kind: "redirect", url: `${proto}//${host}${own[2] && own[2] !== "/" ? own[2] : ""}${search}` };
  if (MAIN_SITE.test(i.path)) return { kind: "redirect", url: `${proto}//${site.host}${i.path}${search}` };
  if (i.path === "/" || i.path === "/services" || i.path.startsWith("/book/") || i.path.startsWith("/booking/")) {
    return { kind: "rewrite", slug: label, path: `/b/${label}${i.path === "/" ? "" : i.path}` };
  }
  return { kind: "none" };
}
