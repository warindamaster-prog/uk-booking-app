import { describe, expect, it } from "vitest";
import { chargeNowPence, extraSeatPence, fullMonthsLeft, MIN_CHARGE_PENCE, summariseSeatChange } from "../seat-change";

const now = new Date("2026-06-01T12:00:00Z");

describe("charge now when seats are added", () => {
  it("monthly: the full month per added person (2 people = £4), whenever in the month", () => {
    expect(extraSeatPence("month")).toBe(200);
    expect(chargeNowPence({ added: 2, interval: "month", periodEnd: new Date("2026-06-29T00:00:00Z"), now })).toBe(400);
    expect(chargeNowPence({ added: 1, interval: "month", periodEnd: null, now })).toBe(200);
  });
  it("yearly: £2 for each whole month left until renewal (month 3 of a year leaves 9 months = £18)", () => {
    expect(extraSeatPence("year")).toBe(2000);
    const start = new Date("2026-01-20T10:00:00Z"), end = new Date("2027-01-20T10:00:00Z");
    const at = (iso: string) => new Date(iso);
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: end, now: at("2026-03-25T10:00:00Z") })).toBe(1800); // in month 3: 9 months left
    expect(chargeNowPence({ added: 2, interval: "year", periodEnd: end, now: at("2026-03-25T10:00:00Z") })).toBe(3600);
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: end, now: at("2026-07-21T10:00:00Z") })).toBe(1000); // 5 months left
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: end, now: start })).toBe(2000); // 12 months, capped at the yearly price
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: end, now: at("2026-01-20T10:05:00Z") })).toBe(2000); // 11 months = £22, capped at £20
    expect(chargeNowPence({ added: 1, interval: "year", periodEnd: end, now: at("2027-01-10T10:00:00Z") })).toBe(200); // last weeks: at least one month
  });
  it("counts whole months, including at the end of short months", () => {
    expect(fullMonthsLeft(new Date("2026-01-31T00:00:00Z"), new Date("2026-03-01T00:00:00Z"))).toBe(1);
    expect(fullMonthsLeft(new Date("2026-01-31T00:00:00Z"), new Date("2026-03-31T00:00:00Z"))).toBe(2);
    expect(fullMonthsLeft(new Date("2026-06-01T00:00:00Z"), new Date("2026-06-20T00:00:00Z"))).toBe(0);
    expect(fullMonthsLeft(new Date("2026-06-01T00:00:00Z"), new Date("2030-06-01T00:00:00Z"))).toBe(12); // never more than a year
  });
  it("charges nothing below Stripe's 30p minimum, and nothing for no seats", () => {
    expect(chargeNowPence({ added: 0, interval: "year", periodEnd: new Date(now.getTime() + 3 * 86_400_000), now })).toBe(0);
    expect(MIN_CHARGE_PENCE).toBe(30);
    expect(chargeNowPence({ added: 0, interval: "month", periodEnd: null, now })).toBe(0);
  });
});

describe("summariseSeatChange", () => {
  const base = { interval: "month" as const, periodEnd: null, now };
  it("adding on a paid plan: charge now and the new plan price", () => {
    expect(summariseSeatChange({ ...base, plan: "paid_increase", current: 3, requested: 5 })).toEqual({ plan: "paid_increase", added: 2, chargeNowNet: 400, newPriceNet: 2300, months: null });
  });
  it("reducing: nothing now, lower price next period (3 people £19 becomes 2 people £17)", () => {
    expect(summariseSeatChange({ ...base, plan: "schedule_reduction", current: 3, requested: 2 })).toEqual({ plan: "schedule_reduction", added: 0, chargeNowNet: 0, newPriceNet: 1700, months: null });
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
  it("yearly: £5 a pack for each whole month left until renewal, never more than £60", () => {
    const e = new Date("2027-01-20T10:00:00Z");
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: e, now: new Date("2026-03-25T10:00:00Z") })).toBe(4500); // 9 months
    expect(chargeNowSmsPence({ added: 2, interval: "year", periodEnd: e, now: new Date("2026-03-25T10:00:00Z") })).toBe(9000);
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: e, now: new Date("2026-01-20T10:05:00Z") })).toBe(5500); // 11 months x £5
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: e, now: new Date("2026-01-20T10:00:00Z") })).toBe(6000); // 12 months = £60, the yearly price
    expect(chargeNowSmsPence({ added: 1, interval: "year", periodEnd: e, now: new Date("2027-01-10T10:00:00Z") })).toBe(500);
  });
  it("summary: only a paid increase charges now, and the new price is the whole plan", () => {
    const s = summariseSmsChange({ plan: "paid_increase", current: 1, requested: 3, seats: 2, interval: "month", periodEnd: end(10), now });
    expect(s).toEqual({ plan: "paid_increase", added: 2, chargeNowNet: 1000, newPriceNet: 1700 + 1500, months: null });
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

describe("popup wording when there is no free trial", () => {
  const sum = (plan: "immediate") => summariseSeatChange({ plan, current: 2, requested: 3, interval: "month", periodEnd: null, now: new Date() });
  it("says nothing is charged because they have not subscribed, not because of a trial", async () => {
    const { describeSeatChange } = await import("../seat-change");
    const d = describeSeatChange(sum("immediate"), { current: 2, requested: 3, interval: "month", periodEndLabel: null, noTrial: true });
    expect(d.lines.join(" ")).toContain("you haven't subscribed");
    expect(d.lines.join(" ")).not.toMatch(/trial/i);
    const t = describeSeatChange(sum("immediate"), { current: 2, requested: 3, interval: "month", periodEndLabel: null });
    expect(t.lines.join(" ")).toContain("free trial");
  });
});

describe("yearly popup wording", () => {
  it("says how many months the charge covers", async () => {
    const { describeSeatChange } = await import("../seat-change");
    const now = new Date("2026-03-25T10:00:00Z"), periodEnd = new Date("2027-01-20T10:00:00Z");
    const sum = summariseSeatChange({ plan: "paid_increase", current: 1, requested: 2, interval: "year", periodEnd, now });
    expect(sum).toMatchObject({ added: 1, chargeNowNet: 1800, months: 9, newPriceNet: 17000 });
    const d = describeSeatChange(sum, { current: 1, requested: 2, interval: "year", periodEndLabel: null });
    expect(d.lines.join(" ")).toContain("£18.00 + VAT (£21.60 in total) now");
    expect(d.lines.join(" ")).toContain("9 months left until your plan renews");
    expect(d.lines.join(" ")).toContain("£170.00 + VAT per year");
  });
});

import { afterEach, vi } from "vitest";
import { smsPacksEnabled } from "../sms-switch";

describe("SMS switch", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is off unless SMS_PACKS_ENABLED is exactly true", () => {
    vi.stubEnv("SMS_PACKS_ENABLED", "");
    expect(smsPacksEnabled()).toBe(false);
    vi.stubEnv("SMS_PACKS_ENABLED", "1");
    expect(smsPacksEnabled()).toBe(false);
    vi.stubEnv("SMS_PACKS_ENABLED", "true");
    expect(smsPacksEnabled()).toBe(true);
  });
});
