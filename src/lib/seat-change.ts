// What a change in the number of people (seats) means in money. Shared by the confirmation
// popup (browser) and the server action, so what the owner is told is what they are charged.
// All amounts are pence BEFORE VAT.

import { formatPence } from "./money";
import { PRICING, grossPence, pricePence, smsPackPricePence, type BillingInterval } from "./pricing";
import type { SeatPlan } from "./stripe/billing";

/** Stripe cannot charge less than 30p. */
export const MIN_CHARGE_PENCE = 30;

/** The price of one extra person for a whole billing period. */
export const extraSeatPence = (interval: BillingInterval) =>
  interval === "year" ? PRICING.extraSeatMonthlyPence * PRICING.yearlyMonthsCharged : PRICING.extraSeatMonthlyPence;

/**
 * Whole months from `now` to `periodEnd`, at most 12. Adding a person in the 3rd month of a year leaves
 * 9 whole months (the 3rd is already under way).
 */
export function fullMonthsLeft(now: Date, periodEnd: Date): number {
  const addMonths = (d: Date, n: number) => {
    const out = new Date(d.getTime());
    const day = out.getUTCDate();
    out.setUTCDate(1);
    out.setUTCMonth(out.getUTCMonth() + n);
    const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
    out.setUTCDate(Math.min(day, last));
    return out;
  };
  let m = 0;
  while (m < 12 && addMonths(now, m + 1).getTime() <= periodEnd.getTime()) m++;
  return m;
}

/**
 * What one added item costs now. Monthly plan: its price for the month. Yearly plan: its MONTHLY price for each
 * whole month left until the plan renews (at least one), never more than its yearly price. From the renewal on,
 * the normal yearly price applies. Example: a yearly plan, 1 person, a second added in month 3: 9 x £2 = £18 now,
 * then £170 a year at renewal for two.
 */
function itemChargePence(i: { monthlyPence: number; yearlyPence: number; interval: BillingInterval; periodEnd: Date | null; now: Date }): { each: number; months: number | null } {
  if (i.interval === "month") return { each: i.monthlyPence, months: null };
  if (!i.periodEnd) return { each: i.yearlyPence, months: null };
  const months = Math.max(1, fullMonthsLeft(i.now, i.periodEnd));
  return { each: Math.min(months * i.monthlyPence, i.yearlyPence), months };
}

type ChargeInput = { added: number; interval: BillingInterval; periodEnd: Date | null; now: Date };

/** Charged straight away when seats are added on a paid plan (see itemChargePence). */
export function chargeNowPence(i: ChargeInput): number {
  const { each } = itemChargePence({ monthlyPence: PRICING.extraSeatMonthlyPence, yearlyPence: extraSeatPence("year"), ...i });
  const amount = Math.max(0, i.added) * each;
  return amount < MIN_CHARGE_PENCE ? 0 : amount;
}

/** How many whole months an added seat or pack is charged for on a yearly plan (null on a monthly plan). */
export function monthsCharged(i: { interval: BillingInterval; periodEnd: Date | null; now: Date }): number | null {
  return itemChargePence({ monthlyPence: 1, yearlyPence: 12, ...i }).months;
}

export type SeatChangeSummary = {
  plan: SeatPlan;
  added: number;
  /** Charged now (net). 0 when nothing is charged. */
  chargeNowNet: number;
  /** The plan price from the next billing period (net), per interval. */
  newPriceNet: number;
  /** Yearly plans: the whole months the charge covers (until the renewal). null otherwise. */
  months: number | null;
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
    months: i.plan === "paid_increase" ? monthsCharged({ interval: i.interval, periodEnd: i.periodEnd, now: i.now }) : null,
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
        lines: [now, ...(sum.months && sum.chargeNowNet > 0 ? [`That covers the ${sum.months} ${sum.months === 1 ? "month" : "months"} left until your plan renews, at ${formatPence(PRICING.extraSeatMonthlyPence)} a month for each person.`] : []), `From your next billing period your plan is ${newPrice}.`],
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

export function chargeNowSmsPence(i: ChargeInput): number {
  const { each } = itemChargePence({ monthlyPence: PRICING.smsPackMonthlyPence, yearlyPence: smsPackPricePence("year"), ...i });
  const amount = Math.max(0, i.added) * each;
  return amount < MIN_CHARGE_PENCE ? 0 : amount;
}

export type SmsChangeSummary = { plan: SeatPlan; added: number; chargeNowNet: number; newPriceNet: number; months: number | null };

export function summariseSmsChange(i: {
  plan: SeatPlan; current: number; requested: number; seats: number; interval: BillingInterval; periodEnd: Date | null; now: Date;
}): SmsChangeSummary {
  const added = Math.max(0, i.requested - i.current);
  return {
    plan: i.plan,
    added,
    chargeNowNet: i.plan === "paid_increase" ? chargeNowSmsPence({ added, interval: i.interval, periodEnd: i.periodEnd, now: i.now }) : 0,
    newPriceNet: pricePence(i.seats, i.interval, i.requested),
    months: i.plan === "paid_increase" ? monthsCharged({ interval: i.interval, periodEnd: i.periodEnd, now: i.now }) : null,
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
        lines: [now, ...(sum.months && sum.chargeNowNet > 0 ? [`That covers the ${sum.months} ${sum.months === 1 ? "month" : "months"} left until your plan renews, at ${formatPence(PRICING.smsPackMonthlyPence)} a month for each pack.`] : []), `You will have ${texts(c.requested)}. From your next billing period your plan is ${newPrice}.`],
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
