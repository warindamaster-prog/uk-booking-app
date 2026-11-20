// What a change in the number of people (seats) means in money. Shared by the confirmation
// popup (browser) and the server action, so what the owner is told is what they are charged.
// All amounts are pence BEFORE VAT.

import { formatPence } from "./money";
import { PRICING, grossPence, pricePence, smsPackPricePence, type BillingInterval } from "./pricing";
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
  return proratedChargePence(Math.max(0, i.added) * extraSeatPence(i.interval), i);
}

/** The charge for `full` pence of added items: all of it monthly, the part of the year left when yearly. */
function proratedChargePence(full: number, i: { interval: BillingInterval; periodEnd: Date | null; now: Date }): number {
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
  /** No free trial: nothing is charged yet only because they have not subscribed. */
  noTrial?: boolean;
}): { title: string; lines: string[]; confirm: string } {
  const per = c.interval;
  const newPrice = `${formatPence(sum.newPriceNet)} + VAT per ${per}`;
  switch (sum.plan) {
    case "immediate":
      return {
        title: `Change your team to ${people(c.requested)}?`,
        lines: c.noTrial
          ? ["Nothing is charged yet: you haven't subscribed.", `Your plan will be ${newPrice} when you subscribe.`]
          : ["Nothing is charged during your free trial.", `After the trial your plan is ${newPrice}.`],
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

// ------------------------------------------------------------------------------ SMS packs
// The same rules as seats: adding is charged at once, reducing waits for the next billing period.
// A pack is £5 a month; on a yearly plan £60 a year (no yearly discount), charged for the part of the year left.

export function chargeNowSmsPence(i: { added: number; interval: BillingInterval; periodEnd: Date | null; now: Date }): number {
  return proratedChargePence(Math.max(0, i.added) * smsPackPricePence(i.interval), i);
}

export type SmsChangeSummary = { plan: SeatPlan; added: number; chargeNowNet: number; newPriceNet: number };

export function summariseSmsChange(i: {
  plan: SeatPlan; current: number; requested: number; seats: number; interval: BillingInterval; periodEnd: Date | null; now: Date;
}): SmsChangeSummary {
  const added = Math.max(0, i.requested - i.current);
  return {
    plan: i.plan,
    added,
    chargeNowNet: i.plan === "paid_increase" ? chargeNowSmsPence({ added, interval: i.interval, periodEnd: i.periodEnd, now: i.now }) : 0,
    newPriceNet: pricePence(i.seats, i.interval, i.requested),
  };
}

const packs = (n: number) => `${n} SMS ${n === 1 ? "pack" : "packs"}`;

export function describeSmsChange(sum: SmsChangeSummary, c: {
  current: number; requested: number; interval: BillingInterval; periodEndLabel: string | null; noTrial?: boolean;
}): { title: string; lines: string[]; confirm: string } {
  const newPrice = `${formatPence(sum.newPriceNet)} + VAT per ${c.interval}`;
  const texts = (n: number) => `${n * PRICING.smsPackTexts} texts a month`;
  switch (sum.plan) {
    case "immediate":
      return {
        title: c.requested === 0 ? "Stop SMS confirmations?" : `Choose ${packs(c.requested)}?`,
        lines: c.noTrial
          ? ["Nothing is charged yet: you haven't subscribed.", `Your plan will be ${newPrice}${c.requested ? ` (${texts(c.requested)} included)` : ""} when you subscribe.`]
          : ["Nothing is charged during your free trial.", `After the trial your plan is ${newPrice}${c.requested ? ` (${texts(c.requested)} included)` : ""}.`],
        confirm: "Confirm",
      };
    case "paid_increase": {
      const now = sum.chargeNowNet > 0
        ? `You will be charged ${formatPence(sum.chargeNowNet)} + VAT (${formatPence(grossPence(sum.chargeNowNet))} in total) now for ${packs(sum.added)}.`
        : "There is nothing to pay now.";
      return {
        title: `Add ${packs(sum.added)}?`,
        lines: [now, `You will have ${texts(c.requested)}. From your next billing period your plan is ${newPrice}.`],
        confirm: sum.chargeNowNet > 0 ? `Pay ${formatPence(grossPence(sum.chargeNowNet))} and add` : "Add",
      };
    }
    case "schedule_reduction":
      return {
        title: c.requested === 0 ? "Stop SMS confirmations?" : `Reduce to ${packs(c.requested)}?`,
        lines: [
          `Next billing period${c.periodEndLabel ? ` (from ${c.periodEndLabel})` : ""}: ${newPrice}.`,
          `Until then you keep ${packs(c.current)} and your price does not change.`,
        ],
        confirm: "Confirm",
      };
    case "cancel_reduction":
      return {
        title: `Keep ${packs(c.current)}?`,
        lines: [`The planned reduction is cancelled. Your plan stays at ${newPrice}.`],
        confirm: "Keep my plan",
      };
    default:
      return { title: "", lines: [], confirm: "Confirm" };
  }
}
