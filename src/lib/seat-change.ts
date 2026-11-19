// What a change in the number of people (seats) means in money. Shared by the confirmation
// popup (browser) and the server action, so what the owner is told is what they are charged.
// All amounts are pence BEFORE VAT.

import { formatPence } from "./money";
import { PRICING, grossPence, pricePence, type BillingInterval } from "./pricing";
import type { SeatPlan } from "./stripe/billing";

/** Stripe cannot charge less than 30p. */
export const MIN_CHARGE_PENCE = 30;
const YEAR_MS = 365 * 86_400_000;

/** The price of one extra person for a whole billing period. */
export const extraSeatPence = (interval: BillingInterval) =>
  interval === "year" ? PRICING.extraSeatMonthlyPence * PRICING.yearlyMonthsCharged : PRICING.extraSeatMonthlyPence;

/**
 * Charged straight away when seats are added on a paid plan.
 * Monthly: the full month for each added person (2 people = £4). Yearly: only the part of the
 * year that is left, because charging a whole year in month 11 would be unfair.
 */
export function chargeNowPence(i: { added: number; interval: BillingInterval; periodEnd: Date | null; now: Date }): number {
  const full = Math.max(0, i.added) * extraSeatPence(i.interval);
  let amount = full;
  if (i.interval === "year" && i.periodEnd) {
    const fraction = Math.min(1, Math.max(0, (i.periodEnd.getTime() - i.now.getTime()) / YEAR_MS));
    amount = Math.round(full * fraction);
  }
  return amount < MIN_CHARGE_PENCE ? 0 : amount;
}

export type SeatChangeSummary = {
  plan: SeatPlan;
  added: number;
  /** Charged now (net). 0 when nothing is charged. */
  chargeNowNet: number;
  /** The plan price from the next billing period (net), per interval. */
  newPriceNet: number;
};

export function summariseSeatChange(i: {
  plan: SeatPlan; current: number; requested: number; interval: BillingInterval; periodEnd: Date | null; now: Date;
}): SeatChangeSummary {
  const added = Math.max(0, i.requested - i.current);
  return {
    plan: i.plan,
    added,
    chargeNowNet: i.plan === "paid_increase" ? chargeNowPence({ added, interval: i.interval, periodEnd: i.periodEnd, now: i.now }) : 0,
    newPriceNet: pricePence(i.requested, i.interval),
  };
}

export { grossPence };

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** The wording of the confirmation popup. */
export function describeSeatChange(sum: SeatChangeSummary, c: {
  current: number; requested: number; interval: BillingInterval; periodEndLabel: string | null;
}): { title: string; lines: string[]; confirm: string } {
  const per = c.interval;
  const newPrice = `${formatPence(sum.newPriceNet)} + VAT per ${per}`;
  switch (sum.plan) {
    case "immediate":
      return {
        title: `Change your team to ${people(c.requested)}?`,
        lines: ["Nothing is charged during your free trial.", `After the trial your plan is ${newPrice}.`],
        confirm: "Confirm",
      };
    case "paid_increase": {
      const now = sum.chargeNowNet > 0
        ? `You will be charged ${formatPence(sum.chargeNowNet)} + VAT (${formatPence(grossPence(sum.chargeNowNet))} in total) now for ${sum.added} more ${sum.added === 1 ? "person" : "people"}.`
        : "There is nothing to pay now.";
      return {
        title: `Add ${sum.added} more ${sum.added === 1 ? "person" : "people"}?`,
        lines: [now, `From your next billing period your plan is ${newPrice}.`],
        confirm: sum.chargeNowNet > 0 ? `Pay ${formatPence(grossPence(sum.chargeNowNet))} and add` : "Add",
      };
    }
    case "schedule_reduction":
      return {
        title: `Reduce your team to ${people(c.requested)}?`,
        lines: [
          `Next billing period${c.periodEndLabel ? ` (from ${c.periodEndLabel})` : ""}: ${newPrice}.`,
          `Until then you keep ${people(c.current)} and your price does not change.`,
        ],
        confirm: "Confirm",
      };
    case "cancel_reduction":
      return {
        title: `Keep ${people(c.current)}?`,
        lines: [`The planned reduction is cancelled. Your plan stays at ${newPrice}.`],
        confirm: "Keep my plan",
      };
    default:
      return { title: "", lines: [], confirm: "Confirm" };
  }
}
