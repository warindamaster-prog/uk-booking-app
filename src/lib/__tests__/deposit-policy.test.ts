import { describe, expect, it } from "vitest";
import { cancelDepositNote, cancelRule, depositPolicyText } from "../deposit-policy";

const base = { policy: null, refundable: true, windowHours: 24, businessName: "Nails <b>" };

describe("deposit policy wording", () => {
  it("the shop's own text wins", () => {
    expect(depositPolicyText({ ...base, policy: "  No refunds, ever.  " })).toBe("No refunds, ever.");
  });
  it("standard sentence matches what happens: refunded if cancelled online in time, otherwise ask the shop", () => {
    const t = depositPolicyText(base);
    expect(t).toContain("at least 1 day before your appointment");
    expect(t).toContain("refunded to your card automatically");
    expect(t).toContain("contact Nails <b>");
    expect(depositPolicyText({ ...base, windowHours: 48 })).toContain("at least 2 days");
    expect(depositPolicyText({ ...base, windowHours: 12 })).toContain("at least 12 hours");
    expect(depositPolicyText({ ...base, windowHours: 0 })).toContain("at any time before your appointment starts");
  });
  it("standard sentence when the shop keeps deposits says so plainly", () => {
    const t = depositPolicyText({ ...base, refundable: false });
    expect(t).toContain("not refunded if you cancel");
    expect(t).not.toContain("automatically");
  });
  it("the cancel button says what happens to the deposit, only when one was paid", () => {
    expect(cancelDepositNote({ refundable: true, depositPaid: true, businessName: "X" })).toBe("Your deposit will be refunded to your card.");
    expect(cancelDepositNote({ refundable: false, depositPaid: true, businessName: "X" })).toBe("X will keep your deposit if you cancel.");
    expect(cancelDepositNote({ refundable: true, depositPaid: false, businessName: "X" })).toBeNull();
  });
});

describe("cancelRule", () => {
  const start = new Date("2026-12-10T12:00:00Z");
  it("lets customers cancel any time when the shop keeps a deposit", () => {
    const r = cancelRule({ refundable: false, depositPence: 1000, windowHours: 72, start, enabled: true });
    expect(r).toEqual({ anyTime: true, deadline: start });
  });
  it("stays as before until it is switched on", () => {
    expect(cancelRule({ refundable: false, depositPence: 1000, windowHours: 72, start, enabled: false }).anyTime).toBe(false);
  });
  it("keeps the window when the deposit is refundable or there is no deposit", () => {
    expect(cancelRule({ refundable: true, depositPence: 1000, windowHours: 72, start, enabled: true })).toEqual({ anyTime: false, deadline: new Date("2026-12-07T12:00:00Z") });
    expect(cancelRule({ refundable: false, depositPence: 0, windowHours: 24, start, enabled: true }).anyTime).toBe(false);
  });
});
