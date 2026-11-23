import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * What search engines may crawl. On the main address: the landing page and privacy notice; never the dashboard, the API, sign-in pages or
 * shops' booking pages. On any other host (a shop's own sub-domain, previews): nothing, until shops are allowed to be found in Google.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  const root = new URL(site).hostname.toLowerCase();
  const host = ((await headers()).get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (host !== root && host !== `www.${root}`) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/", "/auth/", "/onboarding", "/login", "/signup", "/forgot-password", "/reset-password", "/b/"] },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
