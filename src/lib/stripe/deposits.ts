import type Stripe from "stripe";

/** How long a slot is held for an unpaid deposit. Stripe Checkout sessions last at least 30 minutes. */
export const SESSION_MINUTES = 31;
export const HOLD_MINUTES = 35;

export type DepositCheckoutInput = {
  bookingId: string;
  serviceName: string;
  depositPence: number;
  customerEmail: string;
  businessName: string;
  successUrl: string;
  cancelUrl: string;
  now: Date;
};

/**
 * Checkout Session parameters for a deposit. The payment goes straight to the business's own
 * Stripe account (a "direct charge"); there is no application fee, so we take no commission.
 */
export function buildDepositCheckoutParams(i: DepositCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(i.depositPence) || i.depositPence < 30) {
    throw new RangeError("deposit must be a whole number of pence, at least 30 (Stripe's minimum)");
  }
  const description = `${i.serviceName} deposit, ${i.businessName}`.slice(0, 250);
  return {
    mode: "payment",
    client_reference_id: i.bookingId,
    customer_email: i.customerEmail,
    line_items: [{
      quantity: 1,
      price_data: { currency: "gbp", unit_amount: i.depositPence, product_data: { name: `Deposit: ${i.serviceName}`.slice(0, 120) } },
    }],
    payment_intent_data: { description, metadata: { booking_id: i.bookingId } },
    metadata: { booking_id: i.bookingId },
    expires_at: Math.floor(i.now.getTime() / 1000) + SESSION_MINUTES * 60,
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
  };
}

export type RefundChoice = "refund" | "keep";

/**
 * What happens to a paid deposit when a booking is cancelled.
 * The business cancelling always refunds unless the owner chooses to keep it.
 * A customer who cancels online (only possible before the cancellation window) gets it back,
 * unless the shop has chosen to keep deposits when customers cancel (`refundable` false).
 */
export function depositDecision(cancelledBy: "customer" | "business", ownerChoice: RefundChoice | null, refundable = true): RefundChoice {
  if (cancelledBy === "customer") return refundable ? "refund" : "keep";
  return ownerChoice ?? "refund";
}
