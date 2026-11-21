import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingInterval } from "@/lib/pricing";
import { buildPrepaidCheckoutParams, buildSubscriptionCheckoutParams, smsPriceIds } from "./billing";
import type { BillingStore } from "./billing-events";
import { getStripe, stripeConfigured } from "./client";

type Db = ReturnType<typeof createAdminClient>;

/** The prices and VAT rate are created once with `npm run stripe:setup`; their ids go in the environment. */
export const billingStripeReady = () =>
  stripeConfigured() && !!process.env.STRIPE_PRICE_MONTHLY && !!process.env.STRIPE_PRICE_YEARLY && !!process.env.STRIPE_VAT_TAX_RATE_ID;

/** The 3-year prepayment needs only Stripe itself and the VAT rate (its price is built on the fly). */
export const prepaidStripeReady = () => stripeConfigured() && !!process.env.STRIPE_VAT_TAX_RATE_ID;

/** True when the SMS pack prices exist on our Stripe account (created by `npm run stripe:setup`). */
export const smsStripeReady = () => !!process.env.STRIPE_PRICE_SMS_MONTHLY && !!process.env.STRIPE_PRICE_SMS_YEARLY;

export function createBillingStore(db: Db = createAdminClient()): BillingStore {
  return {
    async syncSubscription(businessId, f) {
      const { error } = await db.rpc("sync_subscription", {
        p_business_id: businessId, p_subscription_id: f.id, p_customer_id: f.customerId, p_status: f.status,
        p_period_end: f.periodEnd.toISOString(), p_interval: f.interval, p_quantity: f.quantity, p_sms_quantity: f.smsQuantity,
      });
      if (error) throw new Error(`sync_subscription: ${error.message}`);
    },
    async activatePrepaidTerm(f) {
      const { error } = await db.rpc("activate_prepaid_term", {
        p_business_id: f.businessId, p_payment_intent_id: f.paymentIntentId, p_customer_id: f.customerId, p_seats: f.seats, p_paid_at: f.paidAt.toISOString(),
      });
      if (error) throw new Error(`activate_prepaid_term: ${error.message}`);
    },
    async businessIdForCustomer(customerId) {
      const { data } = await db.from("business_billing").select("business_id").eq("stripe_customer_id", customerId).maybeSingle();
      return data?.business_id ?? null;
    },
  };
}

async function ensureCustomer(db: Db, business: { id: string; name: string; email: string | null }): Promise<string> {
  const { data } = await db.from("business_billing").select("stripe_customer_id").eq("business_id", business.id).single();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await getStripe().customers.create(
    { name: business.name, email: business.email ?? undefined, metadata: { business_id: business.id } },
    { idempotencyKey: `customer:${business.id}` },
  );
  const { error } = await db.from("business_billing").update({ stripe_customer_id: customer.id }).eq("business_id", business.id);
  if (error) throw new Error(`could not save the Stripe customer: ${error.message}`);
  return customer.id;
}

/** Starts the Checkout where the owner adds a card. Returns the Stripe URL. */
export async function startSubscriptionCheckout(db: Db, business: { id: string; name: string; email: string | null }, plan: {
  seats: number; interval: BillingInterval; trialEndsAt: Date; smsPacks?: number;
}): Promise<string> {
  const customerId = await ensureCustomer(db, business);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const session = await getStripe().checkout.sessions.create(buildSubscriptionCheckoutParams({
    businessId: business.id, customerId, seats: plan.seats, trialEndsAt: plan.trialEndsAt, now: new Date(), skipTrial: process.env.BILLING_SKIP_TRIAL === "true",
    priceId: (plan.interval === "year" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY)!,
    vatRateId: process.env.STRIPE_VAT_TAX_RATE_ID!,
    smsPacks: plan.smsPacks ?? 0,
    smsPriceId: plan.interval === "year" ? process.env.STRIPE_PRICE_SMS_YEARLY : process.env.STRIPE_PRICE_SMS_MONTHLY,
    successUrl: `${site}/dashboard/billing?subscribed=1`, cancelUrl: `${site}/dashboard/billing`,
  }));
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Starts the Checkout for the 3-year prepayment (one payment, with VAT). Returns the Stripe URL. */
export async function startPrepaidCheckout(db: Db, business: { id: string; name: string; email: string | null }, plan: { seats: number }): Promise<string> {
  const customerId = await ensureCustomer(db, business);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const session = await getStripe().checkout.sessions.create(buildPrepaidCheckoutParams({
    businessId: business.id, businessName: business.name, customerId, seats: plan.seats, vatRateId: process.env.STRIPE_VAT_TAX_RATE_ID!,
    successUrl: `${site}/dashboard/billing?paid=1`, cancelUrl: `${site}/dashboard/billing`,
  }));
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe's hosted page for the card, invoices and cancelling. */
export async function openBillingPortal(db: Db, businessId: string): Promise<string> {
  const { data } = await db.from("business_billing").select("stripe_customer_id").eq("business_id", businessId).single();
  if (!data?.stripe_customer_id) throw new Error("no Stripe customer yet");
  const session = await getStripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id, return_url: `${publicEnv().NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
  });
  return session.url;
}

/**
 * Sets the quantity on the live subscription WITHOUT charging or crediting anything now:
 * only the next invoice changes. (Extra seats are charged separately, see chargeForExtraSeats.)
 */
export async function setSubscriptionSeats(subscriptionId: string, seats: number): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const sms = smsPriceIds();
  const item = sub.items.data.find((i) => !sms.has(i.price?.id)) ?? sub.items.data[0];
  if (!item) throw new Error("subscription has no items");
  if (item.quantity === seats) return;
  await stripe.subscriptions.update(subscriptionId, { items: [{ id: item.id, quantity: seats }], proration_behavior: "none" });
}

/**
 * Sets the number of SMS packs on the live subscription, again without charging or crediting
 * anything now. Adds the SMS item when there was none, and removes it at zero.
 */
export async function setSubscriptionSmsPacks(subscriptionId: string, packs: number, interval: BillingInterval): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const sms = smsPriceIds();
  const item = sub.items.data.find((i) => sms.has(i.price?.id));
  if (!item) {
    if (packs === 0) return;
    const price = interval === "year" ? process.env.STRIPE_PRICE_SMS_YEARLY : process.env.STRIPE_PRICE_SMS_MONTHLY;
    if (!price) throw new Error("SMS prices are not configured");
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ price, quantity: packs, tax_rates: [process.env.STRIPE_VAT_TAX_RATE_ID!] }], proration_behavior: "none",
    });
    return;
  }
  if (packs === 0) {
    await stripe.subscriptions.update(subscriptionId, { items: [{ id: item.id, deleted: true }], proration_behavior: "none" });
  } else if (item.quantity !== packs) {
    await stripe.subscriptions.update(subscriptionId, { items: [{ id: item.id, quantity: packs }], proration_behavior: "none" });
  }
}

/**
 * Charges the card straight away for extra seats or SMS packs (a one-off invoice with VAT). Throws if the card
 * is declined, and then leaves nothing behind (the draft invoice is voided).
 */
export async function chargeForExtraSeats(db: Db, businessId: string, amountPence: number, description: string, idempotencyKey: string): Promise<string> {
  const { data } = await db.from("business_billing").select("stripe_customer_id, stripe_subscription_id").eq("business_id", businessId).single();
  if (!data?.stripe_customer_id) throw new Error("no Stripe customer");
  const stripe = getStripe();
  const customer = data.stripe_customer_id;
  const paymentMethod = await findPaymentMethod(customer, data.stripe_subscription_id);
  if (!paymentMethod) throw new Error("no saved card to charge");

  // A failed attempt leaves a voided invoice behind, and Stripe replays an idempotency key forever, so a
  // retry must use a new key. The one-minute bucket still stops a double click from charging twice.
  const key = `${idempotencyKey}:${Math.floor(Date.now() / 60_000)}`;
  await stripe.invoiceItems.create(
    { customer, currency: "gbp", amount: amountPence, description, tax_rates: [process.env.STRIPE_VAT_TAX_RATE_ID!] },
    { idempotencyKey: `${key}:item` },
  );
  const invoice = await stripe.invoices.create(
    { customer, collection_method: "charge_automatically", auto_advance: false, pending_invoice_items_behavior: "include", description, default_payment_method: paymentMethod },
    { idempotencyKey: `${key}:invoice` },
  );
  try {
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    const paid = await stripe.invoices.pay(finalized.id, { payment_method: paymentMethod });
    return paid.id;
  } catch (e) {
    await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
    throw e;
  }
}

/**
 * The card to charge for a one-off invoice. Checkout saves the card on the subscription, not as the
 * customer's default, and a standalone invoice only uses the customer's default: so look for the
 * subscription's card first, then the customer's default, then any saved card.
 */
async function findPaymentMethod(customerId: string, subscriptionId: string | null): Promise<string | null> {
  const stripe = getStripe();
  const id = (pm: string | { id: string } | null | undefined) => (typeof pm === "string" ? pm : pm?.id ?? null);
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const fromSub = id(sub.default_payment_method);
    if (fromSub) return fromSub;
  }
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted) {
    const fromCustomer = id(customer.invoice_settings?.default_payment_method);
    if (fromCustomer) return fromCustomer;
  }
  const cards = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  return cards.data[0]?.id ?? null;
}
