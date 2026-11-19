import { describe, expect, it } from "vitest";
import { buildCustomerExport, exportFilename, safeSearchTerm } from "../customers";

describe("safeSearchTerm", () => {
  it("keeps names, emails and phone-like text", () => {
    expect(safeSearchTerm("  Jo  O'Neil ")).toBe("Jo O'Neil");
    expect(safeSearchTerm("pat+x@example.co.uk")).toBe("pat+x@example.co.uk");
    expect(safeSearchTerm("José Müller")).toBe("José Müller");
  });
  it("removes characters that could change a filter or LIKE pattern", () => {
    expect(safeSearchTerm("a,b),name.eq.x")).not.toMatch(/[,()]/);
    expect(safeSearchTerm("100%_*\\")).toBe("100");
    expect(safeSearchTerm('"; drop')).toBe("drop");
    expect(safeSearchTerm(undefined)).toBe("");
    expect(safeSearchTerm("x".repeat(200)).length).toBe(60);
  });
});

describe("buildCustomerExport", () => {
  const out = buildCustomerExport({
    businessName: "Lily Nails", exportedAt: new Date("2026-06-10T12:00:00Z"),
    customer: { name: "Pat", email: "pat@example.com", phone: "07700 900123", marketing_consent: true, marketing_consent_at: "2026-05-01T10:00:00Z", created_at: "2026-05-01T10:00:00Z" },
    bookings: [{ service_name: "Gel", staffName: "Lily", starts_at: "2026-06-02T08:00:00Z", ends_at: "2026-06-02T09:00:00Z", status: "completed",
      price_pence: 3000, deposit_pence: 1000, deposit_status: "paid", created_at: "2026-05-20T09:00:00Z", cancelled_at: null, cancelled_by: null }],
    emails: [{ kind: "confirmation", status: "sent", sent_at: "2026-05-20T09:00:05Z", created_at: "2026-05-20T09:00:04Z" }],
  });
  it("contains the customer's data in readable form", () => {
    expect(out.dataController).toBe("Lily Nails");
    expect(out.customer).toMatchObject({ name: "Pat", email: "pat@example.com", phone: "07700 900123", marketingEmailsConsent: true });
    expect(out.bookings[0]).toMatchObject({ service: "Gel", with: "Lily", pricePence: 3000, depositStatus: "paid", status: "completed" });
    expect(out.emailsSentToCustomer).toEqual([{ type: "confirmation", status: "sent", sentAt: "2026-05-20T09:00:05Z", createdAt: "2026-05-20T09:00:04Z" }]);
  });
  it("never includes internal, security or payment fields", () => {
    const json = JSON.stringify(out);
    for (const forbidden of ["cancel_token", "token", "stripe", "hold_expires", "business_id", "customer_id", "provider_id", "error"]) {
      expect(json.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("names the file with a short id and the date", () => {
    expect(exportFilename("12345678-aaaa-bbbb-cccc-1234567890ab", new Date("2026-06-10T23:30:00Z"))).toBe("customer-data-12345678-2026-06-10.json");
  });
});
