export const billingEnabled = () => process.env.BILLING_ENABLED === "true";

/** Testing: no free trial. A new business must subscribe (and pay) before its booking page opens. */
export const noTrialMode = () => billingEnabled() && process.env.BILLING_SKIP_TRIAL === "true";

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

/** "1 day left" / "5 days left", so the trial banners read correctly on the last day. */
export function daysLeftLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"} left`;
}
