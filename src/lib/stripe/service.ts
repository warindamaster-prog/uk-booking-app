import { shopUrl } from "@/lib/shop-host";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDepositCheckoutParams, depositDecision, type RefundChoice } from "./deposits";
import { getStripe } from "./client";
import { createPaymentStore } from "./store";

type Db = ReturnType<typeof createAdminClient>;

/** Creates the deposit Checkout Session on the business's own Stripe account and returns its URL. */
export async function startDepositCheckout(db: Db, i: {
  bookingId: string; serviceName: string; depositPence: number; customerEmail: string;
  business: { name: string; slug: string; stripe_account_id: string };
  siteUrl: string; token: string;
}): Promise<string> {
  const page = shopUrl({ siteUrl: i.siteUrl, slug: i.business.slug, path: `/booking/${i.token}` });
  const session = await getStripe().checkout.sessions.create(
    buildDepositCheckoutParams({
      bookingId: i.bookingId, serviceName: i.serviceName, depositPence: i.depositPence, customerEmail: i.customerEmail,
      businessName: i.business.name, successUrl: `${page}?paid=1`, cancelUrl: page, now: new Date(),
    }),
    { stripeAccount: i.business.stripe_account_id, idempotencyKey: `checkout:${i.bookingId}` },
  );
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  const { error } = await db.from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", i.bookingId);
  if (error) throw new Error(`could not save the checkout session: ${error.message}`);
  return session.url;
}

export type SettleResult = "refunded" | "retained" | "none" | "failed";

/**
 * Decides and records what happens to a paid deposit after a cancellation.
 * "none": there was no paid deposit. "failed": the refund could not be made (the cron job retries it).
 */
export async function settleDeposit(db: Db, bookingId: string, cancelledBy: "customer" | "business", choice: RefundChoice | null = null): Promise<SettleResult> {
  const { data: b } = await db.from("bookings").select("business_id, status, deposit_status, stripe_payment_intent_id").eq("id", bookingId).maybeSingle();
  if (!b || b.deposit_status !== "paid") return "none";

  const store = createPaymentStore(db);
  const { data: policy } = await db.from("businesses").select("deposit_refundable").eq("id", b.business_id).single();
  // A hold that expired before the customer paid is not a cancellation: that money always goes back.
  const decision = b.status === "expired" ? "refund" : depositDecision(cancelledBy, choice, policy?.deposit_refundable !== false);
  if (decision === "keep") {
    await store.recordDepositOutcome(bookingId, "retained");
    return "retained";
  }
  try {
    const { data: biz } = await db.from("businesses").select("stripe_account_id").eq("id", b.business_id).single();
    if (!biz?.stripe_account_id || !b.stripe_payment_intent_id) throw new Error("no connected Stripe account or payment to refund");
    const refund = await getStripe().refunds.create(
      { payment_intent: b.stripe_payment_intent_id },
      { stripeAccount: biz.stripe_account_id, idempotencyKey: `refund:${bookingId}` },
    );
    await store.recordDepositOutcome(bookingId, "refunded", refund.id);
    return "refunded";
  } catch (e) {
    console.error("deposit refund failed", bookingId, e instanceof Error ? e.message : e);
    return "failed";
  }
}
