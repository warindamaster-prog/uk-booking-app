import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../notifications/resend", () => ({ createMailers: () => ({}) }));

import { newShopEmail } from "../new-shop-alert";

describe("new shop alert", () => {
  const shop = { name: "Lily's <Nails>", slug: "lily-nails", ownerName: "Lily", email: "lily@x.com", phone: "07700 900123", seats: 3, interval: "month" };
  it("names the shop, its address, the owner and the plan", () => {
    const m = newShopEmail(shop, "https://getitbook.com");
    expect(m.subject).toBe("New shop on Get It Book: Lily's <Nails>");
    expect(m.text).toContain("getitbook.com/b/lily-nails");
    expect(m.text).toContain("lily@x.com");
    expect(m.text).toContain("month, 3 people");
  });
  it("escapes the shop's text in the HTML and keeps the subject on one line", () => {
    const m = newShopEmail({ ...shop, name: "A\nB <b>" }, "https://getitbook.com");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).not.toContain("<b>");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});
