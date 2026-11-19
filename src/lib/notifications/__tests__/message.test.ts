import { describe, expect, it } from "vitest";
import { fillMessage } from "../message";
import { renderEmail } from "../templates";

const d = { customerName: "Sam", serviceName: "Gel", staffName: "Alex", businessName: "Nailed-It",
  startsAt: new Date("2027-03-12T14:30:00Z"), tz: "Europe/London" };

describe("shop message", () => {
  it("fills placeholders, ignores case and spaces, leaves unknown ones", () => {
    const out = fillMessage("Hi {{ Customer_Name }}, {{service}} with {{staff}} at {{time}}. {{nope}}", d);
    expect(out).toBe("Hi Sam, Gel with Alex at 14:30. {{nope}}");
  });
  it("appears escaped in the confirmation email only when set", () => {
    const base = { businessName: "Nailed-It", serviceName: "Gel", staffName: "Alex", customerName: "Sam", customerEmail: "s@x.com",
      customerPhone: null, startsAt: d.startsAt, endsAt: new Date("2027-03-12T15:15:00Z"), tz: d.tz, pricePence: 3000, depositPence: 0,
      depositStatus: "none", manageUrl: "https://x/m", dashboardUrl: "https://x/d", cancelDeadline: null, cancelledBy: null, contact: null };
    expect(renderEmail("confirmation", "customer", base).text).not.toContain("Bring");
    const r = renderEmail("confirmation", "customer", { ...base, shopMessage: "Bring ID, {{customer_name}} <b>" });
    expect(r.text).toContain("Bring ID, Sam <b>");
    expect(r.html).toContain("Bring ID, Sam &lt;b&gt;");
  });
});
