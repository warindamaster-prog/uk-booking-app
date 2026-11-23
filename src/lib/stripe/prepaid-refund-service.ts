import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./client";
import { billingAfterRefund, buildCreditNoteParams, findPrepaidInvoice } from "./prepaid-refund";

/**
 * Refunds a shop's 3-year plan in full: a credit note on its Stripe invoice (which also refunds the card), then the shop's billing goes back
 * to the trial (or closed if the trial is over). Returns a message for the admin. Throws if the shop is not on a paid 3-year plan.
 */
export async function refundPrepaidPlan(businessId: string): Promise<string> {
  const db = createAdminClient();
  const { data: b } = await db.from("business_billing").select("status, billing_interval, stripe_customer_id, trial_ends_at, prepaid_payment_intent_id")
    .eq("business_id", businessId).single();
  if (!b || b.billing_interval !== "three_year" || b.status !== "active" || !b.prepaid_payment_intent_id) throw new Error("This shop has no paid 3-year plan to refund.");
  if (!b.stripe_customer_id) throw new Error("This shop has no Stripe customer.");

  const stripe = getStripe();
  const invoices = await stripe.invoices.list({ customer: b.stripe_customer_id, limit: 30 });
  const invoice = findPrepaidInvoice(invoices.data, businessId);
  if (!invoice) throw new Error("Could not find the paid 3-year invoice in Stripe. Refund it in the Stripe dashboard.");

  const note = await stripe.creditNotes.create(buildCreditNoteParams(invoice as never), { idempotencyKey: `prepaid-refund-${businessId}-${b.prepaid_payment_intent_id}` });

  const { error } = await db.from("business_billing").update(billingAfterRefund(b.trial_ends_at)).eq("business_id", businessId);
  if (error) throw new Error(`The refund was made (credit note ${note.number ?? note.id}) but the shop's plan could not be changed: ${error.message}. Change it by hand.`);
  return `Refunded in full. Credit note ${note.number ?? note.id}. The shop's plan is closed.`;
}
