import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_LIFETIME = 60 * 60_000; // onboarding with identity checks can take a while

function mac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(`stripe-connect-state:${payload}`).digest("base64url");
}

/**
 * The OAuth `state` parameter: ties the round trip to one business and a short time window, and
 * is signed so it can't be forged. (The user must also still be logged in as that business's owner.)
 */
export function signConnectState(secret: string, businessId: string, now: Date = new Date()): string {
  const payload = `${businessId}.${now.getTime()}`;
  return `${payload}.${mac(secret, payload)}`;
}

export function verifyConnectState(secret: string, state: string, now: Date = new Date()): { businessId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [businessId, issued, given] = parts;
  const expected = mac(secret, `${businessId}.${issued}`);
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const age = now.getTime() - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > STATE_LIFETIME) return null;
  return { businessId };
}
