import { describe, expect, it } from "vitest";
import { chargeNowPence, extraSeatPence, MIN_CHARGE_PENCE, summariseSeatChange } from "../seat-change";

const now = new Date("2026-06-01T12:00:00Z");

describe("charge now when seats are added", () => {
  it("monthly: the full month per added person (2 people = £4), whenever in the month", () => {
    expect(extraSeatPence("month")).toBe(200);
    expect(chargeNowPence({ added: 2, interval: "month", periodEnd: new Date("2026-06-29T00:00:00Z"), now })).toBe(400);
    expect(chargeNowPence({ added: 1, interval: "month", periodEnd: null, now })).toBe(200);
  });
  it("yearly: the share of the year that is left", () => {
    expect(extraSeatPence("year")).toBe(2000);
    const half = new Date(now.getTime() + 182.5 * 86_400_000);
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: half, now })).toBe(1000);
    expect(chargeNowPence({ added: 2, interval: "year", periodEnd: new Date(now.getTime() + 400 * 86_400_000), now })).toBe(4000); // never more than a full year
  });
  it("charges nothing below Stripe's 30p minimum, and nothing for no seats", () => {
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: new Date(now.getTime() + 3 * 86_400_000), now })).toBe(0);
    expect(MIN_CHARGE_PENCE).toBe(30);
    expect(chargeNowPence({ added: 0, interval: "month", periodEnd: null, now })).toBe(0);
  });
});

describe("summariseSeatChange", () => {
  const base = { interval: "month" as const, periodEnd: null, now };
  it("adding on a paid plan: charge now and the new plan price", () => {
    expect(summariseSeatChange({ ...base, plan: "paid_increase", current: 3, requested: 5 })).toEqual({ plan: "paid_increase", added: 2, chargeNowNet: 400, newPriceNet: 2300 });
  });
  it("reducing: nothing now, lower price next period (3 people £19 becomes 2 people £17)", () => {
    expect(summariseSeatChange({ ...base, plan: "schedule_reduction", current: 3, requested: 2 })).toEqual({ plan: "schedule_reduction", added: 0, chargeNowNet: 0, newPriceNet: 1700 });
  });
  it("during the trial nothing is charged", () => {
    expect(summariseSeatChange({ ...base, plan: "immediate", current: 1, requested: 4 }).chargeNowNet).toBe(0);
  });
});

import { describeSeatChange } from "../seat-change";

describe("popup wording", () => {
  const ctx = { interval: "month" as const, periodEndLabel: "Tue, 30 Jun 2026" };
  const sum = (plan: Parameters<typeof summariseSeatChange>[0]["plan"], current: number, requested: number) =>
    summariseSeatChange({ plan, current, requested, interval: "month", periodEnd: null, now });

  it("adding two people says £4 + VAT is charged now, and what the plan costs afterwards", () => {
    const p = describeSeatChange(sum("paid_increase", 3, 5), { ...ctx, current: 3, requested: 5 });
    expect(p.title).toBe("Add 2 more people?");
    expect(p.lines[0]).toBe("You will be charged £4.00 + VAT (£4.80 in total) now for 2 more people.");
    expect(p.lines[1]).toContain("£23.00 + VAT per month");
    expect(p.confirm).toBe("Pay £4.80 and add");
  });
  it("reducing says what the next billing period costs, and that nothing changes until then", () => {
    const p = describeSeatChange(sum("schedule_reduction", 3, 2), { ...ctx, current: 3, requested: 2 });
    expect(p.lines[0]).toBe("Next billing period (from Tue, 30 Jun 2026): £17.00 + VAT per month.");
    expect(p.lines[1]).toContain("keep 3 people");
  });
  it("trial and cancelling a planned reduction", () => {
    expect(describeSeatChange(sum("immediate", 1, 4), { ...ctx, current: 1, requested: 4 }).lines[0]).toBe("Nothing is charged during your free trial.");
    expect(describeSeatChange(sum("cancel_reduction", 3, 3), { ...ctx, current: 3, requested: 3 }).title).toBe("Keep 3 people?");
  });
});

import { chargeNowSmsPence, describeSmsChange, summariseSmsChange } from "../seat-change";

describe("SMS pack changes", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const end = (days: number) => new Date(now.getTime() + days * 86_400_000);
  it("monthly: a full £5 for each added pack", () => {
    expect(chargeNowSmsPence({ added: 1, interval: "month", periodEnd: end(10), now })).toBe(500);
    expect(chargeNowSmsPence({ added: 3, interval: "month", periodEnd: end(10), now })).toBe(1500);
  });
  it("yearly: £60 a pack for the part of the year left (no yearly discount), nothing under 30p", () => {
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: end(365), now })).toBe(6000);
    expect(chargeNowSmsPence({ added: 2, interval: "year", periodEnd: end(182.5), now })).toBe(6000);
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: end(1), now })).toBe(0);
  });
  it("summary: only a paid increase charges now, and the new price is the whole plan", () => {
    const s = summariseSmsChange({ plan: "paid_increase", current: 1, requested: 3, seats: 2, interval: "month", periodEnd: end(10), now });
    expect(s).toEqual({ plan: "paid_increase", added: 2, chargeNowNet: 1000, newPriceNet: 1700 + 1500 });
    expect(summariseSmsChange({ plan: "schedule_reduction", current: 3, requested: 1, seats: 2, interval: "month", periodEnd: end(10), now }).chargeNowNet).toBe(0);
  });
  it("popup wording says what is charged now and what the next period costs", () => {
    const sum = summariseSmsChange({ plan: "paid_increase", current: 0, requested: 2, seats: 1, interval: "month", periodEnd: end(10), now });
    const d = describeSmsChange(sum, { current: 0, requested: 2, interval: "month", periodEndLabel: null });
    expect(d.title).toBe("Add 2 SMS packs?");
    expect(d.lines.join(" ")).toContain("£10.00 + VAT (£12.00 in total) now for 2 SMS packs");
    expect(d.lines.join(" ")).toContain("100 texts a month");
    const red = describeSmsChange(summariseSmsChange({ plan: "schedule_reduction", current: 2, requested: 0, seats: 1, interval: "month", periodEnd: end(10), now }),
      { current: 2, requested: 0, interval: "month", periodEndLabel: "1 Jul 2026" });
    expect(red.title).toBe("Stop SMS confirmations?");
    expect(red.lines[0]).toContain("from 1 Jul 2026");
    expect(red.lines[0]).toContain("£15.00 + VAT per month");
  });
});
