import { describe, expect, it } from "vitest";
import { renderTrialEndedEmail, renderTrialReminderEmail, trialEmailDue, type TrialRow } from "../trial-email";

const DAY = 86_400_000;
const now = new Date("2027-01-20T12:00:00Z");
const row = (over: Partial<TrialRow> = {}): TrialRow => ({
  status: "trialing", created_at: new Date(now.getTime() - 55 * DAY).toISOString(), trial_ends_at: new Date(now.getTime() + 5 * DAY).toISOString(),
  stripe_subscription_id: null, trial_reminder_sent_at: null, trial_ended_email_sent_at: null, ...over,
});

describe("which trial email is due", () => {
  it("a reminder in the last week, once", () => {
    expect(trialEmailDue(row(), now)).toBe("reminder");
    expect(trialEmailDue(row({ trial_reminder_sent_at: now.toISOString() }), now)).toBeNull();
  });
  it("nothing earlier than a week before the end", () => {
    expect(trialEmailDue(row({ trial_ends_at: new Date(now.getTime() + 8 * DAY).toISOString() }), now)).toBeNull();
  });
  it("after the end: one note for a shop that never subscribed", () => {
    const ended = { trial_ends_at: new Date(now.getTime() - DAY).toISOString() };
    expect(trialEmailDue(row(ended), now)).toBe("ended");
    expect(trialEmailDue(row({ ...ended, trial_ended_email_sent_at: now.toISOString() }), now)).toBeNull();
  });
  it("a shop with a subscription is not told it was locked out (its card is charged instead)", () => {
    expect(trialEmailDue(row({ trial_ends_at: new Date(now.getTime() - DAY).toISOString(), stripe_subscription_id: "sub_1" }), now)).toBeNull();
    expect(trialEmailDue(row({ stripe_subscription_id: "sub_1" }), now)).toBe("reminder"); // but it still gets the heads-up
  });
  it("paying or cancelled shops and cut-short test trials get nothing", () => {
    expect(trialEmailDue(row({ status: "active" }), now)).toBeNull();
    expect(trialEmailDue(row({ status: "canceled" }), now)).toBeNull();
    const created = new Date(now.getTime() - DAY).toISOString();
    expect(trialEmailDue(row({ created_at: created, trial_ends_at: created }), now)).toBeNull(); // test mode ends the trial at sign-up
  });
});

describe("trial emails", () => {
  const base = { shopName: "Nails <b>", billingUrl: "https://x.test/dashboard/billing", supportEmail: "help@x.test" };
  it("reminder tells a card holder they will be charged, and others how to keep the page open", () => {
    const card = renderTrialReminderEmail({ ...base, endsOn: "Sat, 23 Jan 2027", hasCard: true });
    expect(card.text).toContain("first payment is taken on that day");
    const none = renderTrialReminderEmail({ ...base, endsOn: "Sat, 23 Jan 2027", hasCard: false });
    expect(none.text).toContain("help@x.test");
    expect(none.subject).toBe("Your free trial ends on Sat, 23 Jan 2027");
    expect(none.html).not.toContain("<b>"); // shop name is escaped
  });
  it("ended email says bookings are still visible and who to contact", () => {
    const e = renderTrialEndedEmail(base);
    expect(e.text).toContain("still log in and see all your bookings");
    expect(e.text).toContain("help@x.test");
    expect(e.subject).toBe("Your free trial has ended");
  });
});
