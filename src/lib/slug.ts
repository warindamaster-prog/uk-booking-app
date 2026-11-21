export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

/**
 * Web addresses nobody may take. A shop's address is also its sub-domain (shop.getitbook.com), so every name we might want
 * for ourselves (www, app, mail, support...) must stay free, as well as the names of our own pages.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin", "api", "app", "login", "signup", "dashboard", "www", "mail", "email", "smtp", "imap", "pop", "ftp", "ns1", "ns2", "dns",
  "support", "help", "status", "billing", "pay", "payments", "stripe", "auth", "account", "accounts", "my", "blog", "docs", "web", "site",
  "shop", "shops", "book", "booking", "bookings", "onboarding", "privacy", "terms", "legal", "cdn", "static", "assets", "img", "images",
  "dev", "test", "staging", "preview", "demo", "root", "system", "official", "security", "abuse", "postmaster", "webmaster", "hostmaster",
  "getitbook", "get-it-book",
]);

/** "Lily's Nails & Beauty!" -> "lily-s-nails-beauty". May be too short; validate after. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Only same-site relative paths; blocks open redirects like //evil.com or /\evil.com. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
