import type { MetadataRoute } from "next";

/** The public pages worth listing. Shops' booking pages, the dashboard and the sign-in pages are left out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
