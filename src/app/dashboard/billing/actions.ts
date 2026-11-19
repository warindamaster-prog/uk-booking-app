"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { isValidSeats, PRICING, pricePence, type BillingInterval } from "@/lib/pricing";
import { planSeatChange } from "@/lib/stripe/billing";
import { billingStripeReady, openBillingPortal, setSubscriptionSeats, startSubscriptionCheckout } from "@/lib/stripe/billing-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/time";

const GENERIC = "Something went wrong. Please try again.";

function refresh() {
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/staff");
}

export async function updateSeats(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const text = String(formData.get("seats") ?? "").trim();
  const seats = /^\d+$/.test(text) ? Number(text) : NaN;
  const values = { seats: text };
  if (!isValidSeats(seats)) {
    return { fieldErrors: { seats: [`Enter a number from ${PRICING.minSeats} to ${PRICING.maxSeats}`] }, values };
  }

  const { data: b } = await supabase.from("business_billing")
    .select("stripe_subscription_id, staff_seats, next_staff_seats, billing_interval, current_period_end").eq("business_id", business.id).single();
  if (!b) return { error: GENERIC, values };
  const plan = planSeatChange({ current: b.staff_seats, scheduled: b.next_staff_seats, requested: seats, hasSubscription: !!b.stripe_subscription_id });
  const subId = b.stripe_subscription_id as string | null;
  const setSeatsInDb = (n: number) => supabase.rpc("change_staff_seats", { p_business_id: business.id, p_new_seats: n });
  const belowActive = (m: string) => `${m.split(": ")[1] ?? "Some team members are active"}. Set people to "not taking bookings" first, then lower the number.`;

  try {
    switch (plan) {
      case "noop":
        return { message: "Saved.", values };

      case "immediate": { // free trial: nothing to charge
        const { error } = await setSeatsInDb(seats);
        if (error) return { error: error.message?.includes("staff_seats_below_active") ? belowActive(error.message) : GENERIC, values };
        break;
      }

      case "paid_increase": {
        // A pending reduction already lowered Stripe's quantity; put it back first so only the real increase is charged.
        if (b.next_staff_seats !== null) await setSubscriptionSeats(subId!, b.staff_seats, false);
        await setSubscriptionSeats(subId!, seats, true); // charges the prorated amount now; throws if the card fails
        const { error } = await createAdminClient().rpc("apply_seat_increase", { p_business_id: business.id, p_new_seats: seats });
        if (error) console.error("apply_seat_increase failed; the webhook will catch up", error.message);
        refresh();
        return { message: `Your plan now covers ${seats} people. The extra cost for the rest of this period was charged to your card.`, values };
      }

      case "schedule_reduction": {
        const { error } = await setSeatsInDb(seats); // checks nobody active would be left without a seat
        if (error) return { error: error.message?.includes("staff_seats_below_active") ? belowActive(error.message) : GENERIC, values };
        try {
          await setSubscriptionSeats(subId!, seats, false); // changes the next invoice only
        } catch (e) {
          await setSeatsInDb(b.staff_seats); // put the database back so it matches Stripe
          throw e;
        }
        refresh();
        const when = b.current_period_end ? formatDate(b.current_period_end, business.timezone) : "your next renewal";
        return { message: `Saved. You keep ${b.staff_seats} seats until ${when}. After that your price drops to ${formatPence(pricePence(seats, b.billing_interval as BillingInterval))} + VAT.`, values };
      }

      case "cancel_reduction":
        await setSubscriptionSeats(subId!, b.staff_seats, false); // Stripe first, so it can never bill fewer seats than we allow
        await setSeatsInDb(b.staff_seats);
        break;
    }
  } catch (e) {
    console.error("seat change failed", plan, e instanceof Error ? e.message : e);
    return { error: plan === "paid_increase" ? "We couldn't take the payment for the extra seats. Please check your card under Manage billing." : GENERIC, values };
  }
  refresh();
  return { message: "Saved.", values };
}

export async function subscribe(): Promise<void> {
  const { supabase, business } = await requireOwner();
  if (!billingEnabled() || !billingStripeReady()) redirect("/dashboard/billing?error=unavailable");

  const { data: b } = await supabase.from("business_billing")
    .select("stripe_subscription_id, staff_seats, billing_interval, trial_ends_at").eq("business_id", business.id).single();
  const { data: biz } = await supabase.from("businesses").select("email").eq("id", business.id).single();
  if (!b || b.stripe_subscription_id) redirect("/dashboard/billing");

  let url: string;
  try {
    url = await startSubscriptionCheckout(createAdminClient(), { id: business.id, name: business.name, email: biz?.email ?? null },
      { seats: b.staff_seats, interval: b.billing_interval as BillingInterval, trialEndsAt: new Date(b.trial_ends_at) });
  } catch (e) {
    console.error("subscription checkout failed", e instanceof Error ? e.message : e);
    redirect("/dashboard/billing?error=failed");
  }
  redirect(url);
}

export async function manageBilling(): Promise<void> {
  const { business } = await requireOwner();
  let url: string;
  try {
    url = await openBillingPortal(createAdminClient(), business.id);
  } catch (e) {
    console.error("billing portal failed", e instanceof Error ? e.message : e);
    redirect("/dashboard/billing?error=failed");
  }
  redirect(url);
}
