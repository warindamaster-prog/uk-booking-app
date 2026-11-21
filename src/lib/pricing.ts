// Subscription pricing. All amounts are pence and EXCLUDE VAT.
// The SQL twin is public.billing_price_pence(); a database test checks they agree.

export type BillingInterval = "month" | "year";
/** The plans a shop can choose. "three_year" is a one-time prepayment, not a Stripe subscription, so it is NOT a BillingInterval:
 *  all the subscription code (seat changes, SMS packs) only ever sees month or year. */
export type PlanInterval = BillingInterval | "three_year";

export const PRICING = {
  baseMonthlyPence: 1500, // includes the first staff member
  extraSeatMonthlyPence: 200, // each additional staff member
  yearlyMonthsCharged: 10, // 12 months for the price of 10
  vatRate: 0.2,
  minSeats: 1,
  maxSeats: 50,
  trialDays: 60,
  /** Optional SMS confirmations: packs of 50 texts a month. Yearly plans pay 12 full months (no yearly discount). */
  smsPackMonthlyPence: 500,
  smsPackTexts: 50,
  maxSmsPacks: 20,
  /** 3-year prepaid plan: 36 months of the monthly price, 35% off, paid once. At least 3 staff, no SMS packs. */
  threeYearMonths: 36,
  threeYearPercentOfMonthly: 65,
  threeYearMinSeats: 3,
} as const;

export const isThreeYear = (interval: string): interval is "three_year" => interval === "three_year";

export function isValidSmsPacks(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= PRICING.maxSmsPacks;
}

/** One SMS pack for a whole billing period. */
export const smsPackPricePence = (interval: BillingInterval) => PRICING.smsPackMonthlyPence * (interval === "year" ? 12 : 1);

export function isValidSeats(n: number): boolean {
  return Number.isInteger(n) && n >= PRICING.minSeats && n <= PRICING.maxSeats;
}

export function monthlyPricePence(seats: number): number {
  if (!isValidSeats(seats)) throw new RangeError(`seats must be a whole number from ${PRICING.minSeats} to ${PRICING.maxSeats}`);
  return PRICING.baseMonthlyPence + PRICING.extraSeatMonthlyPence * (seats - 1);
}

/** The whole plan per billing period: team seats (yearly = 10 months) plus any SMS packs (yearly = 12 months). */
export function pricePence(seats: number, interval: PlanInterval, smsPacks = 0): number {
  if (!isValidSmsPacks(smsPacks)) throw new RangeError(`SMS packs must be a whole number from 0 to ${PRICING.maxSmsPacks}`);
  const monthly = monthlyPricePence(seats);
  if (interval === "three_year") {
    if (seats < PRICING.threeYearMinSeats) throw new RangeError(`the 3-year plan needs at least ${PRICING.threeYearMinSeats} staff`);
    if (smsPacks !== 0) throw new RangeError("SMS packs are not part of the 3-year plan");
    return Math.round((monthly * PRICING.threeYearMonths * PRICING.threeYearPercentOfMonthly) / 100);
  }
  const seatPart = interval === "year" ? monthly * PRICING.yearlyMonthsCharged : monthly;
  return seatPart + smsPackPricePence(interval) * smsPacks;
}

/** What 12 months on the monthly plan would cost, minus the yearly price. */
export function yearlySavingPence(seats: number): number {
  return monthlyPricePence(seats) * 12 - pricePence(seats, "year");
}

/** What 36 months on the monthly plan cost, minus the 3-year price. */
export function threeYearSavingVsMonthlyPence(seats: number): number {
  return monthlyPricePence(seats) * PRICING.threeYearMonths - pricePence(seats, "three_year");
}

/** What 3 years on the yearly plan cost, minus the 3-year price. */
export function threeYearSavingVsYearlyPence(seats: number): number {
  return pricePence(seats, "year") * 3 - pricePence(seats, "three_year");
}

export const vatPence = (netPence: number) => Math.round(netPence * PRICING.vatRate);
export const grossPence = (netPence: number) => netPence + vatPence(netPence);

export const trialEndsFrom = (start: Date) => new Date(start.getTime() + PRICING.trialDays * 86_400_000);
