/**
 * Whether a shop can take deposits yet, in words the Services pages can use.
 * - "ready": connected to Stripe and Stripe says it can take card payments.
 * - "pending": connected, but Stripe still needs details from the owner.
 * - "none": not connected yet.
 * - "off": card payments aren't switched on for this whole site (no Connect client id).
 */
export type DepositStatus = "ready" | "pending" | "none" | "off";

export function depositStatus(p: { siteConfigured: boolean; stripeAccountId: string | null; chargesEnabled: boolean }): DepositStatus {
  if (!p.siteConfigured) return "off";
  if (!p.stripeAccountId) return "none";
  return p.chargesEnabled ? "ready" : "pending";
}

/** The sentence shown with the deposit field. Null when nothing needs saying. */
export function depositNote(status: DepositStatus): string | null {
  switch (status) {
    case "ready": return null;
    case "none": return "To take a deposit, connect your Stripe account first. Until you do, a service with a deposit can't be booked online.";
    case "pending": return "Your Stripe account is connected but Stripe still needs some details from you. Until it is ready, a service with a deposit can't be booked online.";
    case "off": return "Card deposits aren't switched on for this site yet, so a service with a deposit can't be booked online.";
  }
}
