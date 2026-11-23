import type Stripe from "stripe";
import { PREPAID_KIND } from "./billing";

/** The credit note that cancels the whole 3-year invoice and refunds the card in one go (the invoice must be paid). */
export function buildCreditNoteParams(invoice: Pick<Stripe.Invoice, "id" | "amount_paid"> & { lines: { data: { id: string; quantity?: number | null }[] } }): Stripe.CreditNoteCreateParams {
  return {
    invoice: invoice.id as string,
    lines: invoice.lines.data.map((l) => ({ type: "invoice_line_item" as const, invoice_line_item: l.id, quantity: l.quantity ?? 1 })),
    refund_amount: invoice.amount_paid,
    reason: "order_change",
    memo: "Full refund of the 3-year plan within 14 days of payment.",
  };
}

/** The paid invoice of a shop's 3-year payment (the newest). */
export function findPrepaidInvoice<T extends { status?: string | null; metadata?: Record<string, string> | null }>(invoices: T[], businessId: string): T | null {
  return invoices.find((x) => x.status === "paid" && x.metadata?.kind === PREPAID_KIND && x.metadata?.business_id === businessId) ?? null;
}

/**
 * What a shop's billing row looks like after a refund: no longer paid. If its free trial is still running it goes back to the trial,
 * otherwise it is closed (the booking page closes). The plan choice and team size stay, so the owner can pay again.
 */
export function billingAfterRefund(trialEndsAt: Date | string, now: Date = new Date()) {
  return {
    status: new Date(trialEndsAt) > now ? "trialing" : "canceled",
    current_period_end: null as string | null,
    paid_this_period_pence: 0,
    prepaid_payment_intent_id: null as string | null,
    prepaid_paid_at: null as string | null,
    prepaid_notice_sent_at: null as string | null,
  };
}
