import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for addresses a shop must never be able to point our server at (internal networks). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  if (isIP(v) === 6) {
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v);
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127);
}

const HOST_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** A mail server name that is a real public hostname (no IP addresses, no internal names). */
export function looksLikePublicHostname(host: string): boolean {
  return HOST_RE.test(host) && isIP(host) === 0 && !/\.(local|internal|localhost|lan)$/i.test(host);
}

/** Resolves the name and refuses it if any address is private. Use before every connection. */
export async function assertPublicHost(host: string): Promise<void> {
  if (!looksLikePublicHostname(host)) throw new Error("That mail server address isn't valid.");
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("That mail server address isn't allowed.");
}
