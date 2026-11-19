import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { buildDepositCheckoutParams, depositDecision, HOLD_MINUTES, SESSION_MINUTES } from "../deposits";
import { signConnectState, verifyConnectState } from "../connect";
import { handleConnectEvent, type DepositOutcome, type PaymentDeps } from "../events";

describe("deposit checkout parameters", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const base = { bookingId: "bk_1", serviceName: "Gel manicure", depositPence: 1000, customerEmail: "pat@example.com", businessName: "Lily Nails",
    successUrl: "https://app.example/ok", cancelUrl: "https://app.example/back", now };

  it("charges the deposit in GBP with no application fee, and links the booking", () => {
    const p = buildDepositCheckoutParams(base);
    expect(p.mode).toBe("payment");
    expect(p.line_items![0]).toMatchObject({ quantity: 1, price_data: { currency: "gbp", unit_amount: 1000 } });
    expect(p.client_reference_id).toBe("bk_1");
    expect(p.metadata).toEqual({ booking_id: "bk_1" });
    expect(p.payment_intent_data?.metadata).toEqual({ booking_id: "bk_1" });
    expect(JSON.stringify(p)).not.toContain("application_fee"); // no commission
    expect(p.customer_email).toBe("pat@example.com");
  });
  it("expires when Stripe allows (30 minutes at least) and the hold outlasts the session", () => {
    const p = buildDepositCheckoutParams(base);
    expect(p.expires_at).toBe(Math.floor(now.getTime() / 1000) + SESSION_MINUTES * 60);
    expect(SESSION_MINUTES).toBeGreaterThanOrEqual(30);
    expect(HOLD_MINUTES).toBeGreaterThan(SESSION_MINUTES);
  });
  it("rejects amounts Stripe would refuse", () => {
    for (const bad of [0, 29, 10.5, -5]) expect(() => buildDepositCheckoutParams({ ...base, depositPence: bad })).toThrow(RangeError);
  });
});

describe("depositDecision", () => {
  it("customers are always refunded; the business can choose to keep the deposit", () => {
    expect(depositDecision("customer", "keep")).toBe("refund");
    expect(depositDecision("business", null)).toBe("refund");
    expect(depositDecision("business", "refund")).toBe("refund");
    expect(depositDecision("business", "keep")).toBe("keep");
  });
});

describe("Connect OAuth state", () => {
  const secret = "s".repeat(40);
  const now = new Date("2026-06-01T12:00:00Z");
  it("round-trips for the same business within an hour", () => {
    const state = signConnectState(secret, "biz-1", now);
    expect(verifyConnectState(secret, state, new Date(now.getTime() + 50 * 60_000))).toEqual({ businessId: "biz-1" });
  });
  it("rejects expired, tampered, wrong-secret and malformed state", () => {
    const state = signConnectState(secret, "biz-1", now);
    expect(verifyConnectState(secret, state, new Date(now.getTime() + 61 * 60_000))).toBeNull();
    expect(verifyConnectState(secret, state, new Date(now.getTime() - 1000))).toBeNull();
    expect(verifyConnectState(secret, state.replace("biz-1", "biz-2"), now)).toBeNull();
    expect(verifyConnectState("t".repeat(40), state, now)).toBeNull();
    expect(verifyConnectState(secret, "garbage", now)).toBeNull();
  });
});

describe("connected-account webhook events", () => {
  const log: string[] = [];
  const make = (outcome: DepositOutcome = "confirmed"): PaymentDeps => ({
    store: {
      applyDepositPayment: async (s, p) => { log.push(`apply ${s} ${p}`); return outcome; },
      recordDepositOutcome: async (b, o, r) => { log.push(`record ${b} ${o} ${r ?? ""}`); },
      setChargesEnabled: async (a, e) => { log.push(`charges ${a} ${e}`); },
      disconnectAccount: async (a) => { log.push(`disconnect ${a}`); },
    },
    refund: async (a, pi, key) => { log.push(`refund ${a} ${pi} ${key}`); return { id: "re_1" }; },
    notifyConfirmed: (b) => { log.push(`notify ${b}`); },
  });
  const session = (over: Record<string, unknown> = {}) => ({
    id: "cs_1", object: "checkout.session", mode: "payment", payment_status: "paid", payment_intent: "pi_1",
    metadata: { booking_id: "bk_1" }, client_reference_id: "bk_1", ...over });
  const event = (type: string, object: unknown, account: string | null = "acct_1") =>
    ({ id: "evt_1", type, account: account ?? undefined, data: { object } }) as unknown as Stripe.Event;
  const run = async (e: Stripe.Event, deps: PaymentDeps) => { log.length = 0; return handleConnectEvent(e, deps); };

  it("a paid deposit confirms the booking and triggers the confirmation emails", async () => {
    expect(await run(event("checkout.session.completed", session()), make())).toBe("deposit confirmed the booking");
    expect(log).toEqual(["apply cs_1 pi_1", "notify bk_1"]);
  });
  it("a repeated event does nothing", async () => {
    await run(event("checkout.session.completed", session()), make("already_paid"));
    expect(log).toEqual(["apply cs_1 pi_1"]);
  });
  it("a deposit paid too late is refunded and recorded", async () => {
    expect(await run(event("checkout.session.completed", session()), make("needs_refund"))).toBe("late deposit refunded");
    expect(log).toEqual(["apply cs_1 pi_1", "refund acct_1 pi_1 late-deposit:cs_1", "record bk_1 refunded re_1"]);
  });
  it("ignores unpaid sessions, subscription sessions and events without a connected account", async () => {
    expect(await run(event("checkout.session.completed", session({ payment_status: "unpaid" })), make())).toMatch(/ignored/);
    expect(await run(event("checkout.session.completed", session({ mode: "subscription" })), make())).toMatch(/ignored/);
    expect(await run(event("checkout.session.completed", session(), null), make())).toMatch(/ignored/);
    expect(log).toEqual([]);
  });
  it("keeps the account's payment status in step", async () => {
    await run(event("account.updated", { id: "acct_1", charges_enabled: true }), make());
    expect(log).toEqual(["charges acct_1 true"]);
    await run(event("account.updated", { id: "acct_1", charges_enabled: false }), make());
    expect(log).toEqual(["charges acct_1 false"]);
    await run(event("account.application.deauthorized", {}), make());
    expect(log).toEqual(["disconnect acct_1"]);
  });
});
