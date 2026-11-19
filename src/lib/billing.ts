export const billingEnabled = () => process.env.BILLING_ENABLED === "true";

/**
 * Whether a business's public booking page is open.
 * While billing is switched off (testing phase) every trialing business stays open.
 * Once billing is on, a trial that has ended closes the page until a subscription is active.
 */
export function bookingsOpen(
  b: { status: string; trial_ends_at: string | Date },
  opts: { now: Date; billingEnabled: boolean },
): boolean {
  if (b.status === "active" || b.status === "past_due") return true;
  if (b.status === "trialing") return !opts.billingEnabled || new Date(b.trial_ends_at) > opts.now;
  return false;
}

export function trialDaysLeft(trialEndsAt: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86_400_000));
}
