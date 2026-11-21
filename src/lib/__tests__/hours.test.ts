import { describe, expect, it } from "vitest";
import { DEFAULT_WORKING_HOURS, defaultHoursFields, parseWeeklyHours } from "../hours";

describe("default working hours", () => {
  it("is 08:00 to 17:00 on all seven days and passes the hours parser", () => {
    expect(DEFAULT_WORKING_HOURS).toHaveLength(7);
    const f = defaultHoursFields((m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    const r = parseWeeklyHours((k) => f[k] ?? "");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hours.every((h) => h.start === 480 && h.end === 1020)).toBe(true);
  });
});
