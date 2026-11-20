import { describe, expect, it } from "vitest";
import { depositNote, depositStatus } from "../deposit-status";

describe("deposit readiness", () => {
  it("is ready only when connected and Stripe can take card payments", () => {
    expect(depositStatus({ siteConfigured: true, stripeAccountId: "acct_1", chargesEnabled: true })).toBe("ready");
    expect(depositStatus({ siteConfigured: true, stripeAccountId: "acct_1", chargesEnabled: false })).toBe("pending");
    expect(depositStatus({ siteConfigured: true, stripeAccountId: null, chargesEnabled: false })).toBe("none");
  });
  it("is off when the site has no Connect client id, whatever the shop has", () => {
    expect(depositStatus({ siteConfigured: false, stripeAccountId: "acct_1", chargesEnabled: true })).toBe("off");
  });
  it("only has a note when something is missing", () => {
    expect(depositNote("ready")).toBeNull();
    expect(depositNote("none")).toContain("connect your Stripe account");
    expect(depositNote("pending")).toContain("still needs some details");
    expect(depositNote("off")).toContain("aren't switched on");
  });
});
