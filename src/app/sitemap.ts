import type { MetadataRoute } from "next";
import { BUSINESS_PAGES } from "@/lib/seo-pages";

/** The public pages worth listing: home, the pages per kind of business, the questions page, privacy. Shops' booking pages, the dashboard and the sign-in pages are left out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/for`, changeFrequency: "monthly", priority: 0.8 },
    ...BUSINESS_PAGES.map((p) => ({ url: `${site}/for/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${site}/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
