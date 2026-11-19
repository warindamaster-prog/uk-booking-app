import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { verifyStripeEvent } from "../verify";

// Uses the real Stripe library's signature code, offline.
const stripe = new Stripe("sk_test_dummy");
const CONNECT = "whsec_connect_secret_value";
const PLATFORM = "whsec_platform_secret_value";
const body = JSON.stringify({ id: "evt_123", object: "event", type: "checkout.session.completed", account: "acct_1", data: { object: { id: "cs_1" } } });
const sign = (payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });

describe("verifyStripeEvent", () => {
  it("accepts a correctly signed event from either endpoint", () => {
    expect(verifyStripeEvent(stripe, body, sign(body, CONNECT), [CONNECT, PLATFORM])?.id).toBe("evt_123");
    expect(verifyStripeEvent(stripe, body, sign(body, PLATFORM), [CONNECT, PLATFORM])?.id).toBe("evt_123");
  });
  it("rejects a wrong secret, a tampered body, an old timestamp and garbage", () => {
    expect(verifyStripeEvent(stripe, body, sign(body, "whsec_someone_else"), [CONNECT, PLATFORM])).toBeNull();
    expect(verifyStripeEvent(stripe, body + " ", sign(body, CONNECT), [CONNECT, PLATFORM])).toBeNull();
    expect(verifyStripeEvent(stripe, body, sign(body, CONNECT, Math.floor(Date.now() / 1000) - 3600), [CONNECT])).toBeNull();
    expect(verifyStripeEvent(stripe, body, "t=1,v1=bad", [CONNECT])).toBeNull();
  });
  it("accepts nothing when no secret is configured", () => {
    expect(verifyStripeEvent(stripe, body, sign(body, CONNECT), [undefined, undefined])).toBeNull();
    expect(verifyStripeEvent(stripe, body, sign(body, CONNECT), [])).toBeNull();
  });
});
