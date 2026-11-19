import { describe, expect, it } from "vitest";
import { allowedActions, displayStatus, groupByLocalDay, parseCalendarParams, rangeFor, shiftDate, weekDays, weekStart } from "../calendar";

describe("calendar params", () => {
  const today = "2026-06-10";
  it("defaults to today, day view, all staff", () => {
    expect(parseCalendarParams({}, today)).toEqual({ view: "day", date: today, staff: "all" });
  });
  it("accepts valid values and rejects junk", () => {
    const id = "00000000-0000-4000-8000-0000000000a1";
    expect(parseCalendarParams({ view: "week", date: "2026-07-01", staff: id }, today)).toEqual({ view: "week", date: "2026-07-01", staff: id });
    expect(parseCalendarParams({ view: "year", date: "2026-02-30", staff: "x'; drop" }, today)).toEqual({ view: "day", date: today, staff: "all" });
  });
});

describe("weeks", () => {
  it("starts on Monday and runs 7 days", () => {
    expect(weekStart("2026-06-10")).toBe("2026-06-08"); // Wednesday
    expect(weekStart("2026-06-14")).toBe("2026-06-08"); // Sunday belongs to the week before the next Monday
    expect(weekStart("2026-06-08")).toBe("2026-06-08");
    expect(weekDays("2026-06-10")).toEqual(["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"]);
  });
  it("shifts by a day or a week", () => {
    expect(shiftDate("day", "2026-06-30", 1)).toBe("2026-07-01");
    expect(shiftDate("week", "2026-06-30", -1)).toBe("2026-06-23");
  });
});

describe("range bounds in UK time", () => {
  it("a summer day runs from 23:00Z the day before", () => {
    const r = rangeFor("day", "2026-06-10", "Europe/London");
    expect(r.from.toISOString()).toBe("2026-06-09T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-06-10T23:00:00.000Z");
  });
  it("a week across the spring clock change is 7 days minus an hour", () => {
    const r = rangeFor("week", "2026-03-25", "Europe/London"); // Mon 23 Mar - Sun 29 Mar (clocks go forward on the 29th)
    expect(r.days).toHaveLength(7);
    expect(r.from.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect((r.to.getTime() - r.from.getTime()) / 3.6e6).toBe(7 * 24 - 1);
  });
});

describe("groupByLocalDay", () => {
  it("groups by UK date, so a late evening booking stays on its own day", () => {
    const items = [
      { id: "c", starts_at: "2026-06-10T22:30:00Z" }, // 23:30 on the 10th in BST
      { id: "b", starts_at: "2026-06-10T08:00:00Z" },
      { id: "d", starts_at: "2026-06-10T23:30:00Z" }, // 00:30 on the 11th
    ];
    const g = groupByLocalDay(items, "Europe/London");
    expect([...g.keys()]).toEqual(["2026-06-10", "2026-06-11"]);
    expect(g.get("2026-06-10")!.map((i) => i.id)).toEqual(["b", "c"]);
    expect(g.get("2026-06-11")!.map((i) => i.id)).toEqual(["d"]);
  });
});

describe("allowedActions", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const future = "2026-06-11T10:00:00Z", past = "2026-06-09T10:00:00Z";
  it("upcoming confirmed bookings can be cancelled or moved, not marked no-show", () => {
    expect(allowedActions({ status: "confirmed", starts_at: future }, now)).toEqual({ cancel: true, reschedule: true, markNoShow: false, undoNoShow: false });
  });
  it("past confirmed bookings can be marked no-show, not moved", () => {
    expect(allowedActions({ status: "confirmed", starts_at: past }, now)).toEqual({ cancel: false, reschedule: false, markNoShow: true, undoNoShow: false });
  });
  it("no-shows can be undone; cancelled bookings have no actions", () => {
    expect(allowedActions({ status: "no_show", starts_at: past }, now).undoNoShow).toBe(true);
    expect(allowedActions({ status: "cancelled", starts_at: future }, now)).toEqual({ cancel: false, reschedule: false, markNoShow: false, undoNoShow: false });
  });
});

describe("displayStatus", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const b = (status: string, end: string | undefined, start = "2026-06-10T10:00:00Z") => ({ status, starts_at: start, ends_at: end });
  it("shows a confirmed booking as completed once it has ended", () => {
    expect(displayStatus(b("confirmed", "2026-06-10T11:00:00Z"), now)).toBe("completed");
    expect(displayStatus(b("confirmed", "2026-06-10T12:00:00Z"), now)).toBe("completed");
  });
  it("keeps confirmed while it is still on or in the future", () => {
    expect(displayStatus(b("confirmed", "2026-06-10T12:30:00Z"), now)).toBe("confirmed");
    expect(displayStatus(b("confirmed", "2026-06-11T11:00:00Z", "2026-06-11T10:00:00Z"), now)).toBe("confirmed");
  });
  it("falls back to the start time when there is no end time", () => {
    expect(displayStatus(b("confirmed", undefined, "2026-06-10T09:00:00Z"), now)).toBe("completed");
  });
  it("never changes other statuses", () => {
    for (const s of ["cancelled", "no_show", "pending_payment", "expired", "completed"]) expect(displayStatus(b(s, "2026-06-10T11:00:00Z"), now)).toBe(s);
  });
  it("does not change what can be done: a past confirmed booking can still be marked no-show", () => {
    expect(allowedActions({ status: "confirmed", starts_at: "2026-06-10T10:00:00Z" }, now).markNoShow).toBe(true);
  });
});
