import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldLine } from "../ics";
import { escapeHtml, oneLine, renderEmail, type EmailData } from "../templates";

const data: EmailData = {
  businessName: "Lily Nails", serviceName: "Gel manicure", staffName: "Lily", customerName: "Pat Smith",
  customerEmail: "pat@example.com", customerPhone: "07700 900123",
  startsAt: new Date("2026-06-02T08:00:00Z"), endsAt: new Date("2026-06-02T09:00:00Z"), tz: "Europe/London",
  pricePence: 3000, depositPence: 1000, depositStatus: "paid",
  manageUrl: "https://app.example/b/lily-nails/booking/TOKEN", dashboardUrl: "https://app.example/dashboard/bookings/ID",
  cancelDeadline: new Date("2026-06-01T08:00:00Z"), cancelledBy: null,
  contact: { email: "lily@shop.example", phone: "01234 567890" },
};

describe("ics", () => {
  const base = { uid: "abc@example.com", sequence: 0, method: "PUBLISH" as const, start: data.startsAt, end: data.endsAt,
    summary: "Gel manicure, Lily Nails", now: new Date("2026-05-01T10:00:00Z") };

  it("builds a valid event in UTC with CRLF line endings", () => {
    const s = buildIcs({ ...base, description: "Booked online", url: "https://app.example/x" });
    expect(s.endsWith("\r\n")).toBe(true);
    expect(s).not.toMatch(/[^\r]\n/); // every newline is CRLF
    for (const line of ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:PUBLISH", "UID:abc@example.com", "SEQUENCE:0",
      "DTSTART:20260602T080000Z", "DTEND:20260602T090000Z", "DTSTAMP:20260501T100000Z", "STATUS:CONFIRMED", "END:VCALENDAR"]) {
      expect(s).toContain(line + "\r\n");
    }
    expect(s).toContain("SUMMARY:Gel manicure\\, Lily Nails");
  });
  it("cancellation uses METHOD:CANCEL, STATUS:CANCELLED and a higher sequence for the same UID", () => {
    const s = buildIcs({ ...base, method: "CANCEL", sequence: 3 });
    expect(s).toContain("METHOD:CANCEL");
    expect(s).toContain("STATUS:CANCELLED");
    expect(s).toContain("SEQUENCE:3");
    expect(s).toContain("UID:abc@example.com");
  });
  it("escapes text and strips control characters", () => {
    expect(escapeIcsText("a;b,c\\d\ne\u0007")).toBe("a\;b\\,c\\\\d\\ne");
  });
  it("folds long lines at 75 octets without splitting characters, and unfolding restores the text", () => {
    const long = "SUMMARY:" + "é".repeat(100);
    const folded = foldLine(long);
    for (const physical of folded.split("\r\n")) expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("email templates", () => {
  it("customer confirmation: clear subject, details, manage link and the cancellation deadline", () => {
    const m = renderEmail("confirmation", "customer", data);
    expect(m.subject).toBe("Booking confirmed: Gel manicure on Tue, 2 Jun 2026, 09:00");
    for (const part of ["Lily Nails", "Gel manicure", "09:00", "£30.00", "deposit £10.00, paid", data.manageUrl, "Mon, 1 Jun 2026, 09:00"]) {
      expect(m.text).toContain(part);
    }
    expect(m.html).toContain(`href="${data.manageUrl}"`);
    expect(m.text).not.toContain("07700 900123"); // the customer's own phone isn't repeated back
  });
  it("business confirmation includes the customer's contact details and the dashboard link", () => {
    const m = renderEmail("confirmation", "business", data);
    expect(m.subject).toContain("New booking: Pat Smith");
    for (const part of ["pat@example.com", "07700 900123", data.dashboardUrl]) expect(m.text).toContain(part);
    expect(m.text).not.toContain(data.manageUrl); // never gives the business the customer's private link
  });
  it("reminder, reschedule and both cancellation variants", () => {
    expect(renderEmail("reminder", "customer", data).subject).toMatch(/^Reminder: Gel manicure at 09:00/);
    expect(renderEmail("reschedule", "customer", data).subject).toMatch(/^Your booking has moved/);
    expect(renderEmail("cancellation", "customer", { ...data, cancelledBy: "business" }).text).toContain("Lily Nails has cancelled your booking");
    expect(renderEmail("cancellation", "customer", { ...data, cancelledBy: "customer" }).text).toContain("You have cancelled your booking");
    expect(renderEmail("cancellation", "business", { ...data, cancelledBy: "customer" }).subject).toContain("cancelled by customer");
  });
  it("customer emails include the shop's contact details when allowed, and omit them when turned off", () => {
    const on = renderEmail("confirmation", "customer", data);
    expect(on.text).toContain("Contact Lily Nails: lily@shop.example · 01234 567890");
    expect(on.html).toContain("lily@shop.example");
    const off = renderEmail("confirmation", "customer", { ...data, contact: null });
    expect(off.text).not.toContain("lily@shop.example");
    expect(off.text).not.toContain("01234 567890");
    expect(renderEmail("confirmation", "customer", { ...data, contact: { email: null, phone: "01234 567890" } }).text).toContain("Contact Lily Nails: 01234 567890");
    expect(renderEmail("confirmation", "business", data).text).not.toContain("Contact Lily Nails"); // the business doesn't need its own details
  });
  it("cancellation emails say what happened to the deposit", () => {
    const at = (depositStatus: string, cancelledBy: "customer" | "business" = "customer") =>
      renderEmail("cancellation", "customer", { ...data, cancelledBy, depositStatus }).text;
    expect(at("refunded")).toContain("Your deposit of £10.00 has been refunded to your card");
    expect(at("paid")).toContain("will be refunded to your card");
    expect(at("retained", "business")).toContain("Lily Nails has kept your deposit of £10.00");
    expect(at("none")).not.toContain("deposit of");
    expect(renderEmail("cancellation", "customer", { ...data, depositPence: 0, depositStatus: "none" }).text).not.toContain("deposit of");
  });
  it("without a deadline the email says to contact the business", () => {
    expect(renderEmail("confirmation", "customer", { ...data, cancelDeadline: null }).text).toContain("please contact Lily Nails directly");
  });
  it("shows times in UK time across the clock change", () => {
    const winter = renderEmail("confirmation", "customer", { ...data, startsAt: new Date("2026-01-13T09:00:00Z"), endsAt: new Date("2026-01-13T10:00:00Z") });
    expect(winter.subject).toContain("09:00"); // GMT: same as UTC
  });
  it("escapes HTML in names and keeps subjects on one line", () => {
    const evil = { ...data, customerName: `<script>alert(1)</script>\r\nBcc: x@y.z`, serviceName: `"><img src=x onerror=alert(1)>` };
    const m = renderEmail("confirmation", "business", evil);
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    expect(oneLine("a\r\nb")).toBe("a b");
  });
});
