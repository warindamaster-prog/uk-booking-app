import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DepositOutcome, PaymentStore } from "./events";

export function createPaymentStore(db: ReturnType<typeof createAdminClient> = createAdminClient()): PaymentStore {
  return {
    async applyDepositPayment(sessionId, paymentIntentId) {
      const { data, error } = await db.rpc("apply_deposit_payment", { p_session_id: sessionId, p_payment_intent: paymentIntentId });
      if (error) throw new Error(`apply_deposit_payment: ${error.message}`);
      return data as DepositOutcome;
    },
    async recordDepositOutcome(bookingId, outcome, refundId) {
      const { error } = await db.rpc("record_deposit_outcome", { p_booking_id: bookingId, p_outcome: outcome, p_refund_id: refundId ?? null });
      if (error) throw new Error(`record_deposit_outcome: ${error.message}`);
    },
    async setChargesEnabled(accountId, enabled) {
      const { error } = await db.from("businesses").update({ stripe_charges_enabled: enabled }).eq("stripe_account_id", accountId);
      if (error) throw new Error(`setChargesEnabled: ${error.message}`);
    },
    async disconnectAccount(accountId) {
      const { error } = await db.from("businesses").update({ stripe_account_id: null, stripe_charges_enabled: false }).eq("stripe_account_id", accountId);
      if (error) throw new Error(`disconnectAccount: ${error.message}`);
    },
  };
}
