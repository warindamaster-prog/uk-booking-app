import type Stripe from "stripe";
import { PRICING } from "../pricing";
import { PREPAID_KIND, prepaidNetPence, readSubscription, smsPriceIds, type SubscriptionFacts } from "./billing";

export type PrepaidFacts = { businessId: string; paymentIntentId: string; customerId: string | null; seats: number; paidAt: Date };

export type BillingStore = {
  syncSubscription(businessId: string, facts: SubscriptionFacts): Promise<void>;
  /** Starts the 3-year term (idempotent on the payment intent). */
  activatePrepaidTerm(facts: PrepaidFacts): Promise<void>;
  businessIdForCustomer(customerId: string): Promise<string | null>;
};

export type BillingDeps = {
  store: BillingStore;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
};

/** Events on our own Stripe account: the shops' subscriptions. Returns what was done, for logs and tests. */
export async function handlePlatformEvent(event: Stripe.Event, deps: BillingDeps): Promise<string> {
  let sub: Stripe.Subscription;
  let fallbackBusiness: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.kind === PREPAID_KIND) return handlePrepaid(session, event.created, deps);
      if (session.mode !== "subscription" || !session.subscription) return "ignored: not a subscription checkout";
      fallbackBusiness = session.metadata?.business_id ?? session.client_reference_id ?? null;
      sub = await deps.retrieveSubscription(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      sub = event.data.object as Stripe.Subscription;
      break;
    default:
      return `ignored: ${event.type}`;
  }

  const facts = readSubscription(sub, smsPriceIds());
  if (!facts) return "ignored: subscription has no items";
  const businessId = facts.businessId ?? fallbackBusiness ?? (await deps.store.businessIdForCustomer(facts.customerId));
  if (!businessId) return "ignored: unknown business";

  await deps.store.syncSubscription(businessId, facts);
  return `subscription ${facts.status}`;
}

/** The 3-year prepayment was paid. Checks the amount against our own price before starting the term. */
async function handlePrepaid(session: Stripe.Checkout.Session, eventCreated: number, deps: BillingDeps): Promise<string> {
  if (session.payment_status !== "paid") return "ignored: prepayment not paid yet";
  const businessId = session.metadata?.business_id ?? session.client_reference_id ?? null;
  const seats = Number(session.metadata?.seats);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (!businessId || !paymentIntentId) return "ignored: prepayment without a business or payment";
  if (!Number.isInteger(seats) || seats < PRICING.threeYearMinSeats || seats > PRICING.maxSeats) return "ignored: prepayment with invalid seats";
  // Never trust the browser or a stray session: the net amount must be exactly our price for these seats.
  if (session.amount_subtotal !== prepaidNetPence(businessId, seats)) return "ignored: prepayment amount does not match the price";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  await deps.store.activatePrepaidTerm({ businessId, paymentIntentId, customerId, seats, paidAt: new Date(eventCreated * 1000) });
  return "3-year plan started";
}
