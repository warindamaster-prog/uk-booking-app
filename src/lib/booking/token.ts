import { createHash, createHmac } from "node:crypto";

/**
 * The customer's cancellation token is derived from the booking id with a server secret, so the
 * link can be rebuilt for later emails (reminders) without storing the token. The database keeps
 * only its SHA-256 hash. Without the secret a leaked hash or booking id reveals nothing.
 */
export function deriveCancelToken(secret: string, bookingId: string): { raw: string; hashHex: string } {
  const raw = createHmac("sha256", secret).update(`booking-cancel:${bookingId}`).digest("base64url"); // 43 chars
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
