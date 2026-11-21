import type Stripe from "stripe";
import { PRICING, pricePence, type BillingInterval } from "../pricing";

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
  /** Quantity of the SMS pack item (0 when there is none). null when SMS prices are not configured. */
  smsQuantity: number | null;
};

/** The Stripe price ids of the SMS pack (monthly and yearly), from the environment. */
export function smsPriceIds(env: Record<string, string | undefined> = process.env): ReadonlySet<string> {
  return new Set([env.STRIPE_PRICE_SMS_MONTHLY, env.STRIPE_PRICE_SMS_YEARLY].filter((x): x is string => !!x));
}

/** The facts we store from a Stripe subscription. (The billing period lives on the subscription item.) */
export function readSubscription(sub: Stripe.Subscription, sms: ReadonlySet<string> = new Set()): SubscriptionFacts | null {
  const all = sub.items?.data ?? [];
  const item = all.find((i) => !sms.has(i.price?.id)) ?? all[0]; // the team seats item
  if (!item) return null;
  const smsItem = all.find((i) => sms.has(i.price?.id));
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    businessId: sub.metadata?.business_id ?? null,
    status: mapSubscriptionStatus(sub.status),
    periodEnd: new Date(item.current_period_end * 1000),
    interval: item.price?.recurring?.interval === "year" ? "year" : "month",
    quantity: item.quantity ?? null,
    itemId: item.id,
    smsQuantity: sms.size ? (smsItem?.quantity ?? 0) : null,
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
  /** SMS packs and the Stripe price for them (matching the billing interval). */
  smsPacks?: number;
  smsPriceId?: string;
  trialEndsAt: Date;
  /** Testing: take the first payment at once instead of waiting for the free trial to end. */
  skipTrial?: boolean;
  now: Date;
  successUrl: string;
  cancelUrl: string;
};

/**
 * The shop's plan on OUR Stripe account. A line item for the graduated seat price (first seat £15, each
 * extra £2; yearly is 10 months' worth) with quantity = seats, plus one for SMS packs (£5 each a month; yearly 12
 * months) when chosen, with 20% VAT. The free trial is kept:
 * the card is taken now but nothing is charged until the trial ends.
 */
export function buildSubscriptionCheckoutParams(i: SubscriptionCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(i.seats) || i.seats < PRICING.minSeats || i.seats > PRICING.maxSeats) throw new RangeError("invalid seat count");
  const packs = i.smsPacks ?? 0;
  if (!Number.isInteger(packs) || packs < 0 || packs > PRICING.maxSmsPacks) throw new RangeError("invalid SMS pack count");
  if (packs > 0 && !i.smsPriceId) throw new Error("SMS packs were chosen but no SMS price is configured");
  return {
    mode: "subscription",
    customer: i.customerId,
    client_reference_id: i.businessId,
    metadata: { business_id: i.businessId },
    line_items: [
      { price: i.priceId, quantity: i.seats, tax_rates: [i.vatRateId] },
      ...(packs > 0 ? [{ price: i.smsPriceId!, quantity: packs, tax_rates: [i.vatRateId] }] : []),
    ],
    subscription_data: {
      metadata: { business_id: i.businessId },
      ...(!i.skipTrial && canUseTrialEnd(i.trialEndsAt, i.now) ? { trial_end: Math.floor(i.trialEndsAt.getTime() / 1000) } : {}),
    },
    billing_address_collection: "required", // invoices for UK businesses need an address
    phone_number_collection: { enabled: true },
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
  };
}

export type PrepaidCheckoutInput = {
  businessId: string;
  businessName: string;
  customerId: string;
  vatRateId: string;
  seats: number;
  successUrl: string;
  cancelUrl: string;
};

/** Marks a Checkout Session as the 3-year prepayment. The webhook only acts on sessions that carry it. */
export const PREPAID_KIND = "prepaid_3y";

/**
 * The 3-year prepaid plan: ONE payment (not a subscription) for 36 months at 35% off, plus 20% VAT. The amount is computed here on the server
 * from the same formula as the database, and the webhook checks it again before it starts the term. An invoice is created so the owner
 * gets a proper VAT invoice.
 */
export function buildPrepaidCheckoutParams(i: PrepaidCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(i.seats) || i.seats < PRICING.threeYearMinSeats || i.seats > PRICING.maxSeats) throw new RangeError("invalid seat count");
  const net = pricePence(i.seats, "three_year");
  const description = `3-year prepaid plan for ${i.businessName}: ${i.seats} staff, 36 months`;
  const metadata = { kind: PREPAID_KIND, business_id: i.businessId, seats: String(i.seats) };
  return {
    mode: "payment",
    customer: i.customerId,
    client_reference_id: i.businessId,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: { currency: "gbp", unit_amount: net, tax_behavior: "exclusive", product_data: { name: "3-year prepaid plan", description } },
      tax_rates: [i.vatRateId],
    }],
    payment_intent_data: { metadata, description },
    invoice_creation: { enabled: true, invoice_data: { description, metadata } },
    billing_address_collection: "required",
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
