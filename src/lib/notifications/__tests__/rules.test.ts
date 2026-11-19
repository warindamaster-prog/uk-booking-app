import { describe, expect, it } from "vitest";
import { isReminderDue } from "../due";
import { MAX_ATTEMPTS, recipientsFor, safeDisplayName } from "../rules";

describe("isReminderDue", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const hours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
  const ago = (h: number) => hours(-h);
  const b = (over: Partial<Parameters<typeof isReminderDue>[0]> = {}) =>
    ({ status: "confirmed", starts_at: hours(20), created_at: ago(48), reminder_sent_at: null, ...over });

  it("is due inside the 24 hour window for a booking made earlier", () => {
    expect(isReminderDue(b(), now)).toBe(true);
    expect(isReminderDue(b({ starts_at: hours(24) }), now)).toBe(true);
    expect(isReminderDue(b({ starts_at: hours(0.5) }), now)).toBe(true);
  });
  it("is not due before the window, after the start, or once sent", () => {
    expect(isReminderDue(b({ starts_at: hours(24.1) }), now)).toBe(false);
    expect(isReminderDue(b({ starts_at: ago(1) }), now)).toBe(false);
    expect(isReminderDue(b({ reminder_sent_at: ago(1) }), now)).toBe(false);
  });
  it("only confirmed bookings get reminders", () => {
    for (const status of ["cancelled", "pending_payment", "expired", "no_show"]) expect(isReminderDue(b({ status }), now)).toBe(false);
  });
  it("skips a booking made less than 24 hours ahead: it just got its confirmation", () => {
    expect(isReminderDue(b({ starts_at: hours(10), created_at: ago(1) }), now)).toBe(false);
    expect(isReminderDue(b({ starts_at: hours(23), created_at: ago(0.5) }), now)).toBe(false);
  });
  it("a booking moved into the window still gets a reminder (created long before, reminder flag reset)", () => {
    expect(isReminderDue(b({ starts_at: hours(6), created_at: ago(200) }), now)).toBe(true);
  });
});

describe("who is emailed", () => {
  it("confirmation goes to the customer and the business", () => {
    expect(recipientsFor("confirmation", null)).toEqual(["customer", "business"]);
  });
  it("cancellation: the business is told only when the customer cancelled", () => {
    expect(recipientsFor("cancellation", "customer")).toEqual(["customer", "business"]);
    expect(recipientsFor("cancellation", "business")).toEqual(["customer"]);
  });
  it("a reschedule only goes to the customer", () => {
    expect(recipientsFor("reschedule", null)).toEqual(["customer"]);
  });
  it("gives up after a few attempts", () => expect(MAX_ATTEMPTS).toBe(5));
});

describe("safeDisplayName", () => {
  it("removes characters that could break out of a From header", () => {
    expect(safeDisplayName('Lily "Nails" <evil@x.com>\r\nBcc: a@b.c')).not.toMatch(/["<>\r\n]/);
    expect(safeDisplayName("   ")).toBe("Bookings");
    expect(safeDisplayName("x".repeat(100)).length).toBe(60);
  });
});
