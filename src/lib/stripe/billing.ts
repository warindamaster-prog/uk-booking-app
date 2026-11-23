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
    // A full VAT invoice (over £250) needs the customer's business name and address; a VAT number is optional. `customer_update` saves them on the Stripe customer.
    name_collection: { business: { enabled: true, optional: false } },
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    phone_number_collection: { enabled: true },
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
  };
}

export type PrepaidCheckoutInput = {
  businessId: string;
  businessName: string;
  /** Where Stripe sends the payment receipt: the owner's contact email. Optional. */
  receiptEmail?: string | null;
  customerId: string;
  vatRateId: string;
  seats: number;
  successUrl: string;
  cancelUrl: string;
};

/**
 * The net price (before VAT) of the 3-year plan for one business. Normally our own formula. For ONE named test shop only, two settings
 * (PREPAID_TEST_BUSINESS_ID and PREPAID_TEST_NET_PENCE, between £1 and £10) replace it, so a real card payment and refund can be tested cheaply.
 * Other shops are never affected, and the webhook uses this same function, so the amount is still checked.
 */
export function prepaidNetPence(businessId: string, seats: number, env: Record<string, string | undefined> = process.env): number {
  const test = Number(env.PREPAID_TEST_NET_PENCE);
  if (env.PREPAID_TEST_BUSINESS_ID && env.PREPAID_TEST_BUSINESS_ID === businessId && Number.isInteger(test) && test >= 100 && test <= 1000) return test;
  return pricePence(seats, "three_year");
}

/** Marks a Checkout Session as the 3-year prepayment. The webhook only acts on sessions that carry it. */
export const PREPAID_KIND = "prepaid_3y";

/**
 * The 3-year prepaid plan: ONE payment (not a subscription) for 36 months at 35% off, plus 20% VAT. The amount is computed here on the server
 * from the same formula as the database, and the webhook checks it again before it starts the term. An invoice is created so the owner
 * gets a proper VAT invoice.
 */
export function buildPrepaidCheckoutParams(i: PrepaidCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(i.seats) || i.seats < PRICING.threeYearMinSeats || i.seats > PRICING.maxSeats) throw new RangeError("invalid seat count");
  const net = prepaidNetPence(i.businessId, i.seats);
  const isTest = net !== pricePence(i.seats, "three_year");
  const description = `3-year prepaid plan for ${i.businessName}: ${i.seats} staff, 36 months${isTest ? " (TEST PRICE)" : ""}`;
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
    payment_intent_data: { metadata, description, ...(i.receiptEmail ? { receipt_email: i.receiptEmail } : {}) },
    invoice_creation: { enabled: true, invoice_data: { description, metadata } },
    billing_address_collection: "required",
    // A full VAT invoice (over £250) needs the customer's business name and address; a VAT number is optional.
    name_collection: { business: { enabled: true, optional: false } },
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
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

/** The paid invoice of the 3-year payment (newest first), from a customer's invoices. Returns its page address, or null. */
export function pickPrepaidInvoiceUrl(invoices: { status?: string | null; hosted_invoice_url?: string | null; metadata?: Record<string, string> | null }[], businessId: string): string | null {
  const found = invoices.find((x) => x.status === "paid" && x.metadata?.kind === PREPAID_KIND && x.metadata?.business_id === businessId && x.hosted_invoice_url);
  return found?.hosted_invoice_url ?? null;
}
