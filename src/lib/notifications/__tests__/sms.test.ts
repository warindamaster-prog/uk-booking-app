import { describe, expect, it } from "vitest";
import { renderSmsConfirmation, smsParts } from "../sms";

const d = { businessName: "Nailed-It", customerName: "Sam Taylor", serviceName: "Gel manicure", startsAt: new Date("2027-03-12T14:30:00Z"), tz: "Europe/London", manageUrl: "https://x.test/b/n/booking/abc" };

describe("SMS confirmation text", () => {
  it("names the shop, the customer's first name, the service and the UK time, with the manage link", () => {
    const t = renderSmsConfirmation(d);
    expect(t).toBe("Nailed-It: Hi Sam, your Gel manicure is booked for Fri, 12 Mar 2027, 14:30. View or cancel: https://x.test/b/n/booking/abc");
    expect(smsParts(t)).toBe(1);
  });
  it("strips line breaks and caps long names so a customer can't stuff a message", () => {
    const t = renderSmsConfirmation({ ...d, customerName: "Evil\nName\r\nhttp://bad", serviceName: "x".repeat(200) });
    expect(t).not.toMatch(/[\r\n]/);
    expect(t).toContain("Hi Evil,");
    expect(t).not.toContain("x".repeat(41));
  });
  it("falls back when there is no name, and counts message parts", () => {
    expect(renderSmsConfirmation({ ...d, customerName: "  " })).toContain("Hi there,");
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
  });
});
