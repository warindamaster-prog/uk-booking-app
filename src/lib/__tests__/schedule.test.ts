import { describe, expect, it } from "vitest";
import { dayStatus, isoWeekday, monthBounds, monthDays, monthLabel, parseMonth, shiftMonth } from "../schedule";

describe("schedule month helpers", () => {
  it("parses ?month and falls back to the current month", () => {
    expect(parseMonth("2026-11", "2026-03-05")).toBe("2026-11");
    for (const bad of [undefined, "", "2026-13", "2026-00", "26-11", "2026-1", "junk"]) expect(parseMonth(bad, "2026-03-05")).toBe("2026-03");
  });
  it("moves between months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-03", 12)).toBe("2027-03");
  });
  it("lays out a month starting on Monday", () => {
    expect(isoWeekday("2026-11-01")).toBe(7); // Sunday
    const nov = monthDays("2026-11");
    expect(nov.days).toHaveLength(30);
    expect(nov.leadingBlanks).toBe(6);
    expect(monthDays("2026-06").leadingBlanks).toBe(0); // 1 June 2026 is a Monday
    expect(monthDays("2028-02").days).toHaveLength(29); // leap year
  });
  it("labels the month and bounds it in UK time (clocks change in March/October)", () => {
    expect(monthLabel("2026-11", "Europe/London")).toBe("November 2026");
    expect(monthBounds("2026-10", "Europe/London").to.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(monthBounds("2026-06", "Europe/London").from.toISOString()).toBe("2026-05-31T23:00:00.000Z");
  });
});

describe("dayStatus", () => {
  const tz = "Europe/London";
  const weekdays = new Set([1, 2, 3, 4, 5]);
  const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00Z`).toISOString(); // winter: UK = UTC
  it("is working on a normal weekday and not working on a weekend", () => {
    expect(dayStatus({ day: "2026-11-18", tz, workingWeekdays: weekdays, timeOff: [] })).toBe("working");
    expect(dayStatus({ day: "2026-11-21", tz, workingWeekdays: weekdays, timeOff: [] })).toBe("not_working");
  });
  it("is off when time off covers the whole day, part off when it covers some of it", () => {
    const whole = [{ starts_at: at("2026-11-18", "00:00"), ends_at: at("2026-11-19", "00:00") }];
    const some = [{ starts_at: at("2026-11-18", "13:00"), ends_at: at("2026-11-18", "15:00") }];
    expect(dayStatus({ day: "2026-11-18", tz, workingWeekdays: weekdays, timeOff: whole })).toBe("off");
    expect(dayStatus({ day: "2026-11-18", tz, workingWeekdays: weekdays, timeOff: some })).toBe("part_off");
    expect(dayStatus({ day: "2026-11-17", tz, workingWeekdays: weekdays, timeOff: some })).toBe("working");
  });
  it("a multi-day holiday marks each covered day as off", () => {
    const week = [{ starts_at: at("2026-11-16", "00:00"), ends_at: at("2026-11-21", "00:00") }];
    for (const d of ["2026-11-16", "2026-11-18", "2026-11-20"]) expect(dayStatus({ day: d, tz, workingWeekdays: weekdays, timeOff: week })).toBe("off");
    expect(dayStatus({ day: "2026-11-21", tz, workingWeekdays: weekdays, timeOff: week })).toBe("not_working");
  });
});
