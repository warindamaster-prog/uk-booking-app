"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { isValidSeats, isValidSmsPacks, PRICING, pricePence, type BillingInterval } from "@/lib/pricing";
import { planSeatChange } from "@/lib/stripe/billing";
import { billingStripeReady, chargeForExtraSeats, openBillingPortal, setSubscriptionSeats, setSubscriptionSmsPacks, smsStripeReady, startSubscriptionCheckout } from "@/lib/stripe/billing-service";
import { summariseSeatChange, summariseSmsChange } from "@/lib/seat-change";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/time";

const GENERIC = "Something went wrong. Please try again.";

function refresh() {
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard");
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
    .select("stripe_subscription_id, staff_seats, next_staff_seats, sms_packs, next_sms_packs, billing_interval, current_period_end").eq("business_id", business.id).single();
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
        const sum = summariseSeatChange({ plan, current: b.staff_seats, requested: seats, interval: b.billing_interval as BillingInterval,
          periodEnd: b.current_period_end ? new Date(b.current_period_end) : null, now: new Date() });
        const admin = createAdminClient();
        // A pending reduction already lowered Stripe's quantity; put it back first so only the real increase is billed.
        if (b.next_staff_seats !== null) await setSubscriptionSeats(subId!, b.staff_seats);
        // 1. Take the money first. If the card fails nothing else has changed.
        if (sum.chargeNowNet > 0) {
          await chargeForExtraSeats(admin, business.id, sum.chargeNowNet,
            `${sum.added} extra team ${sum.added === 1 ? "member" : "members"}`, `seats:${business.id}:${b.staff_seats}:${seats}`);
        }
        // 2. From the next invoice on, the larger quantity applies.
        await setSubscriptionSeats(subId!, seats);
        // 3. Our own record (it is the paid-for number the staff limit is enforced against).
        const { error } = await admin.rpc("apply_seat_increase", { p_business_id: business.id, p_new_seats: seats, p_amount_pence: sum.chargeNowNet });
        if (error) console.error("apply_seat_increase failed after payment; the webhook will catch up", error.message);
        refresh();
        const charged = sum.chargeNowNet > 0 ? ` ${formatPence(sum.chargeNowNet)} + VAT was charged to your card.` : "";
        return { message: `Your plan now covers ${seats} people.${charged}`, values };
      }

      case "schedule_reduction": {
        const { error } = await setSeatsInDb(seats); // checks nobody active would be left without a seat
        if (error) return { error: error.message?.includes("staff_seats_below_active") ? belowActive(error.message) : GENERIC, values };
        try {
          await setSubscriptionSeats(subId!, seats); // changes the next invoice only
        } catch (e) {
          await setSeatsInDb(b.staff_seats); // put the database back so it matches Stripe
          throw e;
        }
        refresh();
        const when = b.current_period_end ? formatDate(b.current_period_end, business.timezone) : "your next renewal";
        return { message: `Saved. You keep ${b.staff_seats} seats until ${when}. After that your price drops to ${formatPence(pricePence(seats, b.billing_interval as BillingInterval, b.next_sms_packs ?? b.sms_packs))} + VAT.`, values };
      }

      case "cancel_reduction":
        await setSubscriptionSeats(subId!, b.staff_seats); // Stripe first, so it can never bill fewer seats than we allow
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

/**
 * Buying or reducing SMS packs. Same pattern as team seats: during the trial it applies at once and
 * costs nothing; on a live subscription extra packs are charged first, reductions wait for the renewal.
 */
export async function updateSmsPacks(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const text = String(formData.get("packs") ?? "").trim();
  const packs = /^\d+$/.test(text) ? Number(text) : NaN;
  const values = { packs: text };
  if (!isValidSmsPacks(packs)) {
    return { fieldErrors: { packs: [`Enter a number from 0 to ${PRICING.maxSmsPacks}`] }, values };
  }

  const { data: b } = await supabase.from("business_billing")
    .select("stripe_subscription_id, staff_seats, next_staff_seats, sms_packs, next_sms_packs, billing_interval, current_period_end")
    .eq("business_id", business.id).single();
  if (!b) return { error: GENERIC, values };
  const interval = b.billing_interval as BillingInterval;
  const subId = b.stripe_subscription_id as string | null;
  const plan = planSeatChange({ current: b.sms_packs, scheduled: b.next_sms_packs, requested: packs, hasSubscription: !!subId });
  const setPacksInDb = (n: number) => supabase.rpc("change_sms_packs", { p_business_id: business.id, p_new_packs: n });
  if (subId && !smsStripeReady() && plan !== "noop") {
    return { error: "SMS packs can't be bought on this site yet. Please contact support.", values };
  }

  try {
    switch (plan) {
      case "noop":
        return { message: "Saved.", values };

      case "immediate": { // free trial: nothing to charge
        const { error } = await setPacksInDb(packs);
        if (error) return { error: GENERIC, values };
        break;
      }

      case "paid_increase": {
        const sum = summariseSmsChange({ plan, current: b.sms_packs, requested: packs, seats: b.next_staff_seats ?? b.staff_seats, interval,
          periodEnd: b.current_period_end ? new Date(b.current_period_end) : null, now: new Date() });
        const admin = createAdminClient();
        // A planned reduction already lowered Stripe's quantity; put it back first so only the real increase is billed.
        if (b.next_sms_packs !== null) await setSubscriptionSmsPacks(subId!, b.sms_packs, interval);
        // 1. Take the money first. If the card fails nothing else has changed.
        if (sum.chargeNowNet > 0) {
          await chargeForExtraSeats(admin, business.id, sum.chargeNowNet,
            `${sum.added} extra SMS ${sum.added === 1 ? "pack" : "packs"}`, `sms:${business.id}:${b.sms_packs}:${packs}`);
        }
        // 2. From the next invoice on, the larger quantity applies.
        await setSubscriptionSmsPacks(subId!, packs, interval);
        // 3. Our own record.
        const { error } = await admin.rpc("apply_sms_increase", { p_business_id: business.id, p_new_packs: packs, p_amount_pence: sum.chargeNowNet });
        if (error) console.error("apply_sms_increase failed after payment; the webhook will catch up", error.message);
        refresh();
        const charged = sum.chargeNowNet > 0 ? ` ${formatPence(sum.chargeNowNet)} + VAT was charged to your card.` : "";
        return { message: `You now have ${packs} SMS ${packs === 1 ? "pack" : "packs"} (${packs * PRICING.smsPackTexts} texts a month).${charged}`, values };
      }

      case "schedule_reduction": {
        const { error } = await setPacksInDb(packs);
        if (error) return { error: GENERIC, values };
        try {
          await setSubscriptionSmsPacks(subId!, packs, interval); // changes the next invoice only
        } catch (e) {
          await setPacksInDb(b.sms_packs); // put the database back so it matches Stripe
          throw e;
        }
        refresh();
        const when = b.current_period_end ? formatDate(b.current_period_end, business.timezone) : "your next renewal";
        return { message: `Saved. You keep ${b.sms_packs} ${b.sms_packs === 1 ? "pack" : "packs"} until ${when}. After that your price drops to ${formatPence(pricePence(b.next_staff_seats ?? b.staff_seats, interval, packs))} + VAT.`, values };
      }

      case "cancel_reduction":
        await setSubscriptionSmsPacks(subId!, b.sms_packs, interval); // Stripe first, so it can never bill fewer packs than we allow
        await setPacksInDb(b.sms_packs);
        break;
    }
  } catch (e) {
    console.error("sms pack change failed", plan, e instanceof Error ? e.message : e);
    return { error: plan === "paid_increase" ? "We couldn't take the payment for the SMS packs. Please check your card under Manage billing." : GENERIC, values };
  }
  refresh();
  return { message: "Saved.", values };
}

/** Cancels every change planned for the next billing period (team size and SMS packs): the plan stays as it is. */
export async function keepCurrentPlan(): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const { data: b } = await supabase.from("business_billing")
    .select("stripe_subscription_id, staff_seats, next_staff_seats, sms_packs, next_sms_packs, billing_interval").eq("business_id", business.id).single();
  if (!b) return { error: GENERIC };
  const subId = b.stripe_subscription_id as string | null;
  try {
    if (subId && b.next_staff_seats !== null) await setSubscriptionSeats(subId, b.staff_seats); // Stripe first, so it never bills fewer than we allow
    if (subId && b.next_sms_packs !== null) await setSubscriptionSmsPacks(subId, b.sms_packs, b.billing_interval as BillingInterval);
    if (b.next_staff_seats !== null) { const r = await supabase.rpc("change_staff_seats", { p_business_id: business.id, p_new_seats: b.staff_seats }); if (r.error) throw r.error; }
    if (b.next_sms_packs !== null) { const r = await supabase.rpc("change_sms_packs", { p_business_id: business.id, p_new_packs: b.sms_packs }); if (r.error) throw r.error; }
  } catch (e) {
    console.error("keep current plan failed", e instanceof Error ? e.message : e);
    return { error: GENERIC };
  }
  refresh();
  return { message: "Done. Your plan stays as it is." };
}

/** Switch SMS confirmations on or off without changing what is paid for. */
export async function setSmsEnabled(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const enabled = formData.get("enabled") === "on";
  const { error } = await supabase.rpc("set_sms_enabled", { p_business_id: business.id, p_enabled: enabled });
  if (error) return { error: error.message?.includes("sms_needs_a_pack") ? "Choose at least one SMS pack first." : GENERIC };
  refresh();
  return { message: enabled ? "SMS confirmations are on." : "SMS confirmations are off." };
}

export async function subscribe(): Promise<void> {
  const { supabase, business } = await requireOwner();
  if (!billingEnabled() || !billingStripeReady()) redirect("/dashboard/billing?error=unavailable");

  const { data: b } = await supabase.from("business_billing")
    .select("stripe_subscription_id, staff_seats, sms_packs, billing_interval, trial_ends_at").eq("business_id", business.id).single();
  const { data: biz } = await supabase.from("businesses").select("email").eq("id", business.id).single();
  if (!b || b.stripe_subscription_id) redirect("/dashboard/billing");

  let url: string;
  try {
    url = await startSubscriptionCheckout(createAdminClient(), { id: business.id, name: business.name, email: biz?.email ?? null },
      { seats: b.staff_seats, smsPacks: b.sms_packs, interval: b.billing_interval as BillingInterval, trialEndsAt: new Date(b.trial_ends_at) });
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
