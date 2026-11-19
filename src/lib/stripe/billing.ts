import type Stripe from "stripe";
import { PRICING, type BillingInterval } from "../pricing";

export type OurStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid";

/** Stripe's subscription statuses mapped to the ones we keep. Anything unexpected counts as not paid. */
export function mapSubscriptionStatus(stripeStatus: string): OurStatus {
  switch (stripeStatus) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default: return "unpaid"; // unpaid, incomplete, paused, and anything new
  }
}

export type SubscriptionFacts = {
  id: string;
  customerId: string;
  businessId: string | null;
  status: OurStatus;
  periodEnd: Date;
  interval: BillingInterval;
  quantity: number | null;
  itemId: string;
};

/** The facts we store from a Stripe subscription. (The billing period lives on the subscription item.) */
export function readSubscription(sub: Stripe.Subscription): SubscriptionFacts | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    businessId: sub.metadata?.business_id ?? null,
    status: mapSubscriptionStatus(sub.status),
    periodEnd: new Date(item.current_period_end * 1000),
    interval: item.price?.recurring?.interval === "year" ? "year" : "month",
    quantity: item.quantity ?? null,
    itemId: item.id,
  };
}

/** Stripe Checkout needs a trial end at least 48 hours away; closer than that, the card is charged at once. */
const MIN_TRIAL_MS = 49 * 3_600_000;
export const canUseTrialEnd = (trialEndsAt: Date, now: Date) => trialEndsAt.getTime() - now.getTime() >= MIN_TRIAL_MS;

export type SubscriptionCheckoutInput = {
  businessId: string;
  customerId: string;
  priceId: string;
  vatRateId: string;
  seats: number;
  trialEndsAt: Date;
  now: Date;
  successUrl: string;
  cancelUrl: string;
};

/**
 * The shop's plan on OUR Stripe account. One line item: the graduated price (first seat £15, each
 * extra £2; yearly is 10 months' worth) with quantity = seats, plus 20% VAT. The free trial is kept:
 * the card is taken now but nothing is charged until the trial ends.
 */
export function buildSubscriptionCheckoutParams(i: SubscriptionCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(i.seats) || i.seats < PRICING.minSeats || i.seats > PRICING.maxSeats) throw new RangeError("invalid seat count");
  return {
    mode: "subscription",
    customer: i.customerId,
    client_reference_id: i.businessId,
    metadata: { business_id: i.businessId },
    line_items: [{ price: i.priceId, quantity: i.seats, tax_rates: [i.vatRateId] }],
    subscription_data: {
      metadata: { business_id: i.businessId },
      ...(canUseTrialEnd(i.trialEndsAt, i.now) ? { trial_end: Math.floor(i.trialEndsAt.getTime() / 1000) } : {}),
    },
    billing_address_collection: "required", // invoices for UK businesses need an address
    phone_number_collection: { enabled: true },
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
  };
}

export type SeatPlan = "immediate" | "noop" | "cancel_reduction" | "paid_increase" | "schedule_reduction";

/** What a requested seat count means for this business right now. */
export function planSeatChange(i: { current: number; scheduled: number | null; requested: number; hasSubscription: boolean }): SeatPlan {
  if (!i.hasSubscription) return "immediate"; // trial: nothing is charged
  if (i.requested === i.current) return i.scheduled === null ? "noop" : "cancel_reduction";
  return i.requested > i.current ? "paid_increase" : "schedule_reduction";
}
