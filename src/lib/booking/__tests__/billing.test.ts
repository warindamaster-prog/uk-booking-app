import { describe, expect, it } from "vitest";
import { bookingsOpen, trialDaysLeft } from "../../billing";
import { grossPence, isValidSeats, monthlyPricePence, PRICING, pricePence, trialEndsFrom, vatPence, yearlySavingPence } from "../../pricing";
import { onboardingSchema } from "../../validation/business";

describe("pricing", () => {
  it("1 person is £15 and each extra person adds £2 per month", () => {
    expect([1, 2, 3, 5, 10].map(monthlyPricePence)).toEqual([1500, 1700, 1900, 2300, 3300]);
  });
  it("yearly charges 10 months", () => {
    expect([1, 3, 5, 10].map((n) => pricePence(n, "year"))).toEqual([15000, 19000, 23000, 33000]);
    expect(yearlySavingPence(3)).toBe(3800); // 12 x 1900 - 19000
  });
  it("a reduction from 3 to 2 staff lowers next month from £19 to £17", () => {
    expect(pricePence(3, "month")).toBe(1900);
    expect(pricePence(2, "month")).toBe(1700);
  });
  it("adds VAT at 20% in whole pence", () => {
    expect(vatPence(1500)).toBe(300);
    expect(grossPence(1500)).toBe(1800);
    expect(vatPence(1900)).toBe(380);
    expect(grossPence(2333)).toBe(2333 + 467);
  });
  it("rejects invalid seat counts", () => {
    for (const bad of [0, -1, 1.5, 51, NaN]) {
      expect(isValidSeats(bad)).toBe(false);
      expect(() => monthlyPricePence(bad)).toThrow(RangeError);
    }
  });
  it("the trial is 60 days", () => {
    expect(PRICING.trialDays).toBe(60);
    expect(trialEndsFrom(new Date("2026-01-01T00:00:00Z")).toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});

describe("bookingsOpen", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const trial = (end: string) => ({ status: "trialing", trial_ends_at: end });
  it("stays open for every trial while billing is switched off", () => {
    expect(bookingsOpen(trial("2026-01-01T00:00:00Z"), { now, billingEnabled: false })).toBe(true);
  });
  it("closes after the trial once billing is on, unless subscribed", () => {
    expect(bookingsOpen(trial("2026-07-01T00:00:00Z"), { now, billingEnabled: true })).toBe(true);
    expect(bookingsOpen(trial("2026-05-01T00:00:00Z"), { now, billingEnabled: true })).toBe(false);
    expect(bookingsOpen({ status: "active", trial_ends_at: "2026-05-01T00:00:00Z" }, { now, billingEnabled: true })).toBe(true);
    expect(bookingsOpen({ status: "past_due", trial_ends_at: "2026-05-01T00:00:00Z" }, { now, billingEnabled: true })).toBe(true);
  });
  it("stays closed for cancelled or unpaid businesses", () => {
    for (const status of ["canceled", "unpaid"]) {
      expect(bookingsOpen({ status, trial_ends_at: "2030-01-01T00:00:00Z" }, { now, billingEnabled: false })).toBe(false);
    }
  });
  it("counts trial days left, never below zero", () => {
    expect(trialDaysLeft("2026-06-11T12:00:00Z", now)).toBe(10);
    expect(trialDaysLeft("2026-06-01T12:00:01Z", now)).toBe(1);
    expect(trialDaysLeft("2026-05-01T00:00:00Z", now)).toBe(0);
  });
});

describe("onboardingSchema (setup form)", () => {
  const ok = { name: "Lily Nails", slug: "lily-nails", ownerName: "Lily", email: "Lily@Example.com", phone: "07700 900123", seats: "3", interval: "year" };
  it("accepts a valid form and normalises", () => {
    expect(onboardingSchema.parse(ok)).toMatchObject({ email: "lily@example.com", seats: 3, interval: "year" });
  });
  it.each([
    ["no seats", { seats: "" }], ["zero seats", { seats: "0" }], ["too many seats", { seats: "51" }], ["decimal seats", { seats: "2.5" }],
    ["bad interval", { interval: "weekly" }], ["bad phone", { phone: "call me" }], ["bad email", { email: "nope" }], ["no owner", { ownerName: " " }],
  ])("rejects %s", (_n, over) => {
    expect(onboardingSchema.safeParse({ ...ok, ...over }).success).toBe(false);
  });
});
