import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingInterval } from "@/lib/pricing";
import { buildSubscriptionCheckoutParams } from "./billing";
import type { BillingStore } from "./billing-events";
import { getStripe, stripeConfigured } from "./client";

type Db = ReturnType<typeof createAdminClient>;

/** The prices and VAT rate are created once with `npm run stripe:setup`; their ids go in the environment. */
export const billingStripeReady = () =>
  stripeConfigured() && !!process.env.STRIPE_PRICE_MONTHLY && !!process.env.STRIPE_PRICE_YEARLY && !!process.env.STRIPE_VAT_TAX_RATE_ID;

export function createBillingStore(db: Db = createAdminClient()): BillingStore {
  return {
    async syncSubscription(businessId, f) {
      const { error } = await db.rpc("sync_subscription", {
        p_business_id: businessId, p_subscription_id: f.id, p_customer_id: f.customerId, p_status: f.status,
        p_period_end: f.periodEnd.toISOString(), p_interval: f.interval, p_quantity: f.quantity,
      });
      if (error) throw new Error(`sync_subscription: ${error.message}`);
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
  seats: number; interval: BillingInterval; trialEndsAt: Date;
}): Promise<string> {
  const customerId = await ensureCustomer(db, business);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const session = await getStripe().checkout.sessions.create(buildSubscriptionCheckoutParams({
    businessId: business.id, customerId, seats: plan.seats, trialEndsAt: plan.trialEndsAt, now: new Date(),
    priceId: (plan.interval === "year" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY)!,
    vatRateId: process.env.STRIPE_VAT_TAX_RATE_ID!,
    successUrl: `${site}/dashboard/billing?subscribed=1`, cancelUrl: `${site}/dashboard/billing`,
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

/** Sets the quantity on the live subscription. `invoiceNow` charges the prorated difference at once. */
export async function setSubscriptionSeats(subscriptionId: string, seats: number, invoiceNow: boolean): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error("subscription has no items");
  if (item.quantity === seats) return;
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, quantity: seats }],
    // Increases are charged now (prorated). Reductions change only the NEXT invoice: nothing is credited or charged now.
    proration_behavior: invoiceNow ? "always_invoice" : "none",
    ...(invoiceNow ? { payment_behavior: "error_if_incomplete" as const } : {}),
  });
}
