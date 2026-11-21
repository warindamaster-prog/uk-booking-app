import "server-only";
import { headers } from "next/headers";
import { shopSubdomainsEnabled } from "./shop-host";

/**
 * The start of this shop's page addresses for links inside the pages: "" on the shop's own sub-domain (links look like /book/...),
 * and "/b/<shop>" everywhere else (main address, previews, sub-domains switched off).
 */
export async function shopBase(slug: string): Promise<string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!shopSubdomainsEnabled() || !site) return `/b/${slug}`;
  const host = ((await headers()).get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  return host === `${slug}.${new URL(site).hostname.toLowerCase()}` ? "" : `/b/${slug}`;
}
