import { describe, expect, it } from "vitest";
import { billingAfterRefund, buildCreditNoteParams, findPrepaidInvoice } from "../prepaid-refund";
import { isPlatformAdmin } from "../../platform-admin";

describe("3-year refund", () => {
  it("credits every line of the invoice and refunds what was paid", () => {
    const p = buildCreditNoteParams({ id: "in_1", amount_paid: 53352, lines: { data: [{ id: "il_1", quantity: 1 }] } } as never);
    expect(p).toMatchObject({ invoice: "in_1", refund_amount: 53352, lines: [{ type: "invoice_line_item", invoice_line_item: "il_1", quantity: 1 }] });
  });
  it("finds only this shop's paid 3-year invoice", () => {
    const inv = (over: object) => ({ status: "paid", metadata: { kind: "prepaid_3y", business_id: "b1" }, ...over });
    expect(findPrepaidInvoice([inv({})], "b1")).not.toBeNull();
    expect(findPrepaidInvoice([inv({})], "b2")).toBeNull();
    expect(findPrepaidInvoice([inv({ status: "open" })], "b1")).toBeNull();
    expect(findPrepaidInvoice([inv({ metadata: {} })], "b1")).toBeNull();
  });
  it("puts a shop back on its trial if the trial is still running, otherwise closes it", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(billingAfterRefund("2027-01-19T00:00:00Z", now)).toMatchObject({ status: "trialing", prepaid_payment_intent_id: null, paid_this_period_pence: 0, current_period_end: null });
    expect(billingAfterRefund("2026-11-01T00:00:00Z", now).status).toBe("canceled");
  });
});

describe("platform admin", () => {
  it("is only for the listed emails", () => {
    expect(isPlatformAdmin("Me@x.com", "me@x.com, you@y.com")).toBe(true);
    expect(isPlatformAdmin("other@x.com", "me@x.com")).toBe(false);
    expect(isPlatformAdmin("me@x.com", undefined)).toBe(false);
    expect(isPlatformAdmin(null, "me@x.com")).toBe(false);
  });
});
