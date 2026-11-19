import { createHash, createHmac, randomBytes } from "node:crypto";

/** Random cancellation token. Only the SHA-256 hash is stored; the raw value goes in the customer's link. */
export function newCancelToken(): { raw: string; hashHex: string } {
  const raw = randomBytes(32).toString("base64url"); // 43 chars
  return { raw, hashHex: hashToken(raw) };
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** PostgREST wants bytea as "\x<hex>". */
export const byteaParam = (hex: string) => `\\x${hex}`;

/** Rate-limit keys use a keyed hash so raw IPs and emails are never stored. */
export function limiterKey(kind: string, value: string, secret: string): string {
  return `${kind}:${createHmac("sha256", secret).update(value).digest("hex").slice(0, 32)}`;
}

/** First address in x-forwarded-for (set by Vercel), else x-real-ip, else "unknown". */
export function clientIp(get: (name: string) => string | null): string {
  const xff = get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || get("x-real-ip")?.trim() || "unknown";
}
