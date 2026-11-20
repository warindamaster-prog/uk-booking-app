import { describe, expect, it } from "vitest";
import { renderSupportEmail, supportInbox, supportSchema } from "../support";

describe("support message", () => {
  it("needs a topic, a real message and a valid reply address", () => {
    expect(supportSchema.safeParse({ topic: "billing", message: "short", replyTo: "a@b.co" }).success).toBe(false);
    expect(supportSchema.safeParse({ topic: "nope", message: "long enough message", replyTo: "a@b.co" }).success).toBe(false);
    expect(supportSchema.safeParse({ topic: "billing", message: "long enough message", replyTo: "nope" }).success).toBe(false);
    expect(supportSchema.parse({ topic: "billing", message: "  long enough message ", replyTo: " A@B.co " }).replyTo).toBe("a@b.co");
  });
  it("email names the shop and escapes html", () => {
    const e = renderSupportEmail({ shopName: "Nails <b>", shopSlug: "nails", businessId: "id1", userEmail: "o@x.co", role: "owner", billingStatus: "active", replyTo: "o@x.co", topic: "billing", message: "<script>x</script> help me" });
    expect(e.subject).toBe("[Support] Nails <b>: Billing and subscription");
    expect(e.html).not.toContain("<script>");
    expect(e.text).toContain("Shop id: id1");
  });
  it("goes to SUPPORT_EMAIL when set, else the platform mailbox", () => {
    expect(supportInbox({ SUPPORT_EMAIL: " help@x.co " } as never, "sales@x.co")).toBe("help@x.co");
    expect(supportInbox({} as never, "sales@x.co")).toBe("sales@x.co");
  });
});
