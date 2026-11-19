import type Stripe from "stripe";

/**
 * Checks a webhook's signature against each configured endpoint secret (Connect events and
 * platform events have different secrets) and returns the verified event, or null.
 * `body` must be the exact raw request body.
 */
export function verifyStripeEvent(
  stripe: Pick<Stripe, "webhooks">, body: string, signature: string, secrets: (string | undefined)[],
): Stripe.Event | null {
  for (const secret of secrets) {
    if (!secret) continue;
    try { return stripe.webhooks.constructEvent(body, signature, secret); } catch { /* try the next secret */ }
  }
  return null;
}
