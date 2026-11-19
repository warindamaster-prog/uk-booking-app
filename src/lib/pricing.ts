// Subscription pricing. All amounts are pence and EXCLUDE VAT.
// The SQL twin is public.billing_price_pence(); a database test checks they agree.

export type BillingInterval = "month" | "year";

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
} as const;

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
export function pricePence(seats: number, interval: BillingInterval, smsPacks = 0): number {
  if (!isValidSmsPacks(smsPacks)) throw new RangeError(`SMS packs must be a whole number from 0 to ${PRICING.maxSmsPacks}`);
  const monthly = monthlyPricePence(seats);
  const seatPart = interval === "year" ? monthly * PRICING.yearlyMonthsCharged : monthly;
  return seatPart + smsPackPricePence(interval) * smsPacks;
}

/** What 12 months on the monthly plan would cost, minus the yearly price. */
export function yearlySavingPence(seats: number): number {
  return monthlyPricePence(seats) * 12 - pricePence(seats, "year");
}

export const vatPence = (netPence: number) => Math.round(netPence * PRICING.vatRate);
export const grossPence = (netPence: number) => netPence + vatPence(netPence);

export const trialEndsFrom = (start: Date) => new Date(start.getTime() + PRICING.trialDays * 86_400_000);
