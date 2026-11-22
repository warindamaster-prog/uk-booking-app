/**
 * What customers are told about their deposit before they pay and in their emails.
 * The shop's own text wins; otherwise a standard sentence that matches what the system really does.
 */
export const DEPOSIT_POLICY_MAX = 600;

function hoursPhrase(hours: number): string {
  if (hours <= 0) return "at any time before your appointment starts";
  if (hours % 24 === 0) return `at least ${hours / 24} day${hours === 24 ? "" : "s"} before your appointment`;
  return `at least ${hours} hour${hours === 1 ? "" : "s"} before your appointment`;
}

export function depositPolicyText(p: { policy: string | null; refundable: boolean; windowHours: number; businessName: string }): string {
  const own = p.policy?.trim();
  if (own) return own;
  if (!p.refundable) {
    return `Your deposit is not refunded if you cancel. If something comes up, please contact ${p.businessName}: they may choose to return it.`;
  }
  return `If you cancel online ${hoursPhrase(p.windowHours)}, your deposit is refunded to your card automatically. After that, please contact ${p.businessName}: the deposit may not be refunded.`;
}

/** The sentence shown just before a customer confirms a cancellation, about what happens to their deposit. */
export function cancelDepositNote(p: { refundable: boolean; depositPaid: boolean; businessName: string }): string | null {
  if (!p.depositPaid) return null;
  return p.refundable
    ? "Your deposit will be refunded to your card."
    : `${p.businessName} will keep your deposit if you cancel.`;
}

/**
 * When a customer may cancel online. A shop that keeps the deposit (not refundable) and a booking with a deposit: any time before
 * the appointment starts, because no refund depends on the window. Otherwise: until the window starts.
 */
export function cancelRule(p: { refundable: boolean; depositPence: number; windowHours: number; start: Date }): { anyTime: boolean; deadline: Date } {
  const anyTime = !p.refundable && p.depositPence > 0;
  return { anyTime, deadline: anyTime ? p.start : new Date(p.start.getTime() - p.windowHours * 3_600_000) };
}
