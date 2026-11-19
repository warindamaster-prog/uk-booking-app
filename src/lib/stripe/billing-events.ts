import type Stripe from "stripe";
import { readSubscription, smsPriceIds, type SubscriptionFacts } from "./billing";

export type BillingStore = {
  syncSubscription(businessId: string, facts: SubscriptionFacts): Promise<void>;
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
