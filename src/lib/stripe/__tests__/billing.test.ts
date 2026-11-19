import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { buildSubscriptionCheckoutParams, canUseTrialEnd, mapSubscriptionStatus, planSeatChange, readSubscription, smsPriceIds, type SubscriptionFacts } from "../billing";
import { handlePlatformEvent, type BillingDeps } from "../billing-events";

const now = new Date("2026-06-01T12:00:00Z");
const base = { businessId: "biz_1", customerId: "cus_1", priceId: "price_m", vatRateId: "txr_vat", seats: 3, now,
  trialEndsAt: new Date("2026-07-15T00:00:00Z"), successUrl: "https://app.example/ok", cancelUrl: "https://app.example/back" };

describe("subscription checkout parameters", () => {
  it("one graduated-price line with quantity = seats and 20% VAT, linked to the business", () => {
    const p = buildSubscriptionCheckoutParams(base);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_m", quantity: 3, tax_rates: ["txr_vat"] }]);
    expect(p.metadata).toEqual({ business_id: "biz_1" });
    expect(p.subscription_data?.metadata).toEqual({ business_id: "biz_1" });
    expect(p.customer).toBe("cus_1");
  });
  it("asks for the billing address and a phone number", () => {
    const p = buildSubscriptionCheckoutParams(base);
    expect(p.billing_address_collection).toBe("required");
    expect(p.phone_number_collection).toEqual({ enabled: true });
  });
  it("keeps the free trial: nothing is charged until the trial ends", () => {
    expect(buildSubscriptionCheckoutParams(base).subscription_data?.trial_end).toBe(Math.floor(base.trialEndsAt.getTime() / 1000));
  });
  it("can skip the trial for testing: the first payment is taken at once", () => {
    expect(buildSubscriptionCheckoutParams({ ...base, skipTrial: true }).subscription_data).not.toHaveProperty("trial_end");
    expect(buildSubscriptionCheckoutParams({ ...base, skipTrial: false }).subscription_data?.trial_end).toBe(Math.floor(base.trialEndsAt.getTime() / 1000));
  });
  it("with less than 48 hours of trial left (Stripe's minimum) or none, the card is charged at once", () => {
    expect(canUseTrialEnd(new Date("2026-06-03T12:00:00Z"), now)).toBe(false); // exactly 48 hours
    expect(canUseTrialEnd(new Date("2026-06-03T14:00:00Z"), now)).toBe(true);
    expect(buildSubscriptionCheckoutParams({ ...base, trialEndsAt: new Date("2026-05-01T00:00:00Z") }).subscription_data).not.toHaveProperty("trial_end");
  });
  it("rejects invalid seat counts", () => {
    for (const seats of [0, 51, 1.5]) expect(() => buildSubscriptionCheckoutParams({ ...base, seats })).toThrow(RangeError);
  });
});

describe("SMS packs on the subscription", () => {
  it("adds a second line for the packs, with VAT, only when packs are chosen", () => {
    const p = buildSubscriptionCheckoutParams({ ...base, smsPacks: 2, smsPriceId: "price_sms_m" });
    expect(p.line_items).toEqual([
      { price: "price_m", quantity: 3, tax_rates: ["txr_vat"] },
      { price: "price_sms_m", quantity: 2, tax_rates: ["txr_vat"] },
    ]);
    expect(buildSubscriptionCheckoutParams({ ...base, smsPacks: 0, smsPriceId: "price_sms_m" }).line_items).toHaveLength(1);
  });
  it("refuses packs without a price, and bad pack counts", () => {
    expect(() => buildSubscriptionCheckoutParams({ ...base, smsPacks: 1 })).toThrow(/no SMS price/);
    for (const smsPacks of [-1, 21, 1.5]) expect(() => buildSubscriptionCheckoutParams({ ...base, smsPacks, smsPriceId: "p" })).toThrow(RangeError);
  });
  const two = (over: Record<string, unknown> = {}) => sub({
    items: { data: [
      { id: "si_sms", quantity: 4, current_period_end: 1_790_000_000, price: { id: "price_sms_m", recurring: { interval: "month" } } },
      { id: "si_seats", quantity: 3, current_period_end: 1_790_000_000, price: { id: "price_m", recurring: { interval: "month" } } },
    ] }, ...over });
  it("tells the seat item from the SMS item by price, in any order", () => {
    const f = readSubscription(two(), new Set(["price_sms_m"]));
    expect(f).toMatchObject({ itemId: "si_seats", quantity: 3, smsQuantity: 4, interval: "month" });
  });
  it("reports zero packs when SMS is configured but the subscription has none, and null when it is not configured", () => {
    expect(readSubscription(sub({ items: { data: [{ id: "si_1", quantity: 3, current_period_end: 1_790_000_000, price: { id: "price_m", recurring: { interval: "month" } } }] } }), new Set(["price_sms_m"]))).toMatchObject({ quantity: 3, smsQuantity: 0 });
    expect(readSubscription(two())?.smsQuantity).toBeNull();
  });
  it("reads the SMS price ids from the environment", () => {
    expect([...smsPriceIds({ STRIPE_PRICE_SMS_MONTHLY: "a", STRIPE_PRICE_SMS_YEARLY: "b" })]).toEqual(["a", "b"]);
    expect(smsPriceIds({}).size).toBe(0);
  });
});

describe("mapSubscriptionStatus", () => {
  it("maps Stripe statuses to ours, treating anything unexpected as unpaid", () => {
    expect(["trialing", "active", "past_due", "canceled", "incomplete_expired", "unpaid", "incomplete", "paused", "something_new"].map(mapSubscriptionStatus))
      .toEqual(["trialing", "active", "past_due", "canceled", "canceled", "unpaid", "unpaid", "unpaid", "unpaid"]);
  });
});

const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1", object: "subscription", status: "active", customer: "cus_1", metadata: { business_id: "biz_1" },
  items: { data: [{ id: "si_1", quantity: 3, current_period_end: 1_790_000_000, price: { recurring: { interval: "year" } } }] }, ...over,
}) as unknown as Stripe.Subscription;

describe("readSubscription", () => {
  it("reads the period from the item, plus interval, quantity and business", () => {
    expect(readSubscription(sub())).toEqual({ id: "sub_1", customerId: "cus_1", businessId: "biz_1", status: "active",
      periodEnd: new Date(1_790_000_000 * 1000), interval: "year", quantity: 3, itemId: "si_1", smsQuantity: null });
  });
  it("handles an expanded customer, no metadata, and a subscription without items", () => {
    expect(readSubscription(sub({ customer: { id: "cus_9" }, metadata: {} }))).toMatchObject({ customerId: "cus_9", businessId: null });
    expect(readSubscription(sub({ items: { data: [] } }))).toBeNull();
  });
});

describe("planSeatChange", () => {
  it("trial: immediate; subscribed: increases are paid, reductions wait, equal cancels a pending reduction", () => {
    expect(planSeatChange({ current: 3, scheduled: null, requested: 2, hasSubscription: false })).toBe("immediate");
    expect(planSeatChange({ current: 3, scheduled: null, requested: 5, hasSubscription: true })).toBe("paid_increase");
    expect(planSeatChange({ current: 3, scheduled: null, requested: 2, hasSubscription: true })).toBe("schedule_reduction");
    expect(planSeatChange({ current: 3, scheduled: 2, requested: 3, hasSubscription: true })).toBe("cancel_reduction");
    expect(planSeatChange({ current: 3, scheduled: null, requested: 3, hasSubscription: true })).toBe("noop");
  });
});

describe("platform webhook events", () => {
  const log: string[] = [];
  const deps = (over: Partial<BillingDeps> = {}): BillingDeps => ({
    store: {
      syncSubscription: async (b, f: SubscriptionFacts) => { log.push(`sync ${b} ${f.id} ${f.status} ${f.quantity} ${f.interval}`); },
      businessIdForCustomer: async (c) => (c === "cus_known" ? "biz_from_customer" : null),
    },
    retrieveSubscription: async (id) => { log.push(`retrieve ${id}`); return sub({ id }); },
    ...over,
  });
  const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;
  const run = async (e: Stripe.Event, d = deps()) => { log.length = 0; return handlePlatformEvent(e, d); };

  it("subscription updates are synced", async () => {
    expect(await run(ev("customer.subscription.updated", sub({ status: "past_due" })))).toBe("subscription past_due");
    expect(log).toEqual(["sync biz_1 sub_1 past_due 3 year"]);
    expect(await run(ev("customer.subscription.deleted", sub({ status: "canceled" })))).toBe("subscription canceled");
  });
  it("a completed subscription checkout loads the subscription and syncs it", async () => {
    await run(ev("checkout.session.completed", { mode: "subscription", subscription: "sub_7", metadata: { business_id: "biz_1" } }));
    expect(log).toEqual(["retrieve sub_7", "sync biz_1 sub_7 active 3 year"]);
  });
  it("finds the business through the customer when metadata is missing, or ignores unknown ones", async () => {
    await run(ev("customer.subscription.updated", sub({ metadata: {}, customer: "cus_known" })));
    expect(log).toEqual(["sync biz_from_customer sub_1 active 3 year"]);
    expect(await run(ev("customer.subscription.updated", sub({ metadata: {}, customer: "cus_stranger" })))).toBe("ignored: unknown business");
    expect(log).toEqual([]);
  });
  it("ignores deposit checkouts and other event types", async () => {
    expect(await run(ev("checkout.session.completed", { mode: "payment" }))).toMatch(/ignored/);
    expect(await run(ev("invoice.paid", {}))).toMatch(/ignored/);
    expect(log).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { PRICING, pricePence } from "../../pricing";

describe("stripe setup script matches the pricing formula", () => {
  const script = readFileSync("scripts/stripe-setup.mjs", "utf8");
  it("uses the same first-seat and extra-seat prices, monthly and yearly", () => {
    expect(script).toContain(`first: ${pricePence(1, "month")}, extra: ${PRICING.extraSeatMonthlyPence}`);
    expect(script).toContain(`first: ${pricePence(1, "year")}, extra: ${PRICING.extraSeatMonthlyPence * PRICING.yearlyMonthsCharged}`);
    expect(script).toContain(`percentage: ${PRICING.vatRate * 100}`);
  });
  it("creates flat SMS pack prices that match the formula: monthly once, yearly 12 months", () => {
    expect(script).toContain(`interval: "month", amount: ${pricePence(1, "month", 1) - pricePence(1, "month")}`);
    expect(script).toContain(`interval: "year", amount: ${pricePence(1, "year", 1) - pricePence(1, "year")}`);
    expect(pricePence(1, "year", 1) - pricePence(1, "year")).toBe(PRICING.smsPackMonthlyPence * 12); // no yearly discount on SMS
  });
  it("graduated tiers add up to the same price as the formula for any seat count", () => {
    const tiered = (first: number, extra: number, seats: number) => first + extra * (seats - 1);
    for (let seats = 1; seats <= 50; seats++) {
      expect(tiered(1500, 200, seats)).toBe(pricePence(seats, "month"));
      expect(tiered(15000, 2000, seats)).toBe(pricePence(seats, "year"));
    }
  });
});
