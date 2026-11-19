import type Stripe from "stripe";

// Handlers for Stripe webhook events. They talk to the database and Stripe only through the
// small interfaces below, so they can be tested without either.

export type DepositOutcome = "confirmed" | "already_paid" | "needs_refund" | "not_found";

export type PaymentStore = {
  applyDepositPayment(sessionId: string, paymentIntentId: string): Promise<DepositOutcome>;
  recordDepositOutcome(bookingId: string, outcome: "refunded" | "retained", refundId?: string): Promise<void>;
  setChargesEnabled(accountId: string, enabled: boolean): Promise<void>;
  disconnectAccount(accountId: string): Promise<void>;
};

export type PaymentDeps = {
  store: PaymentStore;
  /** Refunds a payment on a connected account. */
  refund(accountId: string, paymentIntentId: string, idempotencyKey: string): Promise<{ id: string }>;
  /** Fire-and-forget: sends the booking confirmation emails. */
  notifyConfirmed(bookingId: string): void;
};

const paymentIntentId = (s: Stripe.Checkout.Session): string | null =>
  typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;

/** Events from connected accounts (deposits and account status). Returns what was done, for logs and tests. */
export async function handleConnectEvent(event: Stripe.Event, deps: PaymentDeps): Promise<string> {
  const account = event.account;
  if (!account) return "ignored: not a connected-account event";

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment" || session.payment_status !== "paid") return "ignored: not a paid payment session";
      const pi = paymentIntentId(session);
      if (!pi) return "ignored: no payment intent";

      const outcome = await deps.store.applyDepositPayment(session.id, pi);
      const bookingId = session.metadata?.booking_id ?? session.client_reference_id ?? null;
      if (outcome === "confirmed") {
        if (bookingId) deps.notifyConfirmed(bookingId);
        return "deposit confirmed the booking";
      }
      if (outcome === "needs_refund") {
        // The customer paid after the hold ended or the booking was cancelled: give the money back.
        const refund = await deps.refund(account, pi, `late-deposit:${session.id}`);
        if (bookingId) await deps.store.recordDepositOutcome(bookingId, "refunded", refund.id);
        return "late deposit refunded";
      }
      return outcome === "already_paid" ? "ignored: already processed" : "ignored: unknown session";
    }
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      await deps.store.setChargesEnabled(acct.id, acct.charges_enabled === true);
      return `account ${acct.charges_enabled ? "can" : "cannot"} take payments`;
    }
    case "account.application.deauthorized":
      await deps.store.disconnectAccount(account);
      return "account disconnected";
    default:
      return `ignored: ${event.type}`;
  }
}
