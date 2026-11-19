import { describe, expect, it } from "vitest";
import { isValidLocalTime } from "../../time";
import { computeSlots, findAvailableDates, isoWeekday, type AvailabilityQuery, type StaffDay } from "../engine";

const TZ = "Europe/London";
const NOW = new Date("2026-05-01T08:00:00Z");
const iso = (s: string) => new Date(s);
const day = (start: string, end: string) => ({ start: iso(start), end: iso(end) });

// Tuesday 2026-06-02 (BST): local 09:00 = 08:00Z
const TUE = "2026-06-02";
const hours = (weekday: number, ...ranges: [number, number][]) => ranges.map(([start, end]) => ({ weekday, start, end }));
const staff = (id: string, over: Partial<StaffDay> = {}): StaffDay => ({ id, workingHours: hours(2, [540, 720]), timeOff: [], blocked: [], ...over });
const query = (over: Partial<AvailabilityQuery> = {}): AvailabilityQuery => ({
  tz: TZ, date: TUE, now: NOW, slotIntervalMinutes: 30, minNoticeMinutes: 0, maxAdvanceDays: 60,
  service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }, staff: [staff("a")], ...over,
});
const starts = (q: AvailabilityQuery) => computeSlots(q).map((s) => s.start.toISOString().slice(11, 16));

describe("basic slot generation", () => {
  it("offers every start where the whole service fits, in UTC", () => {
    // 09:00-12:00 local, 60 min, every 30 min => 09:00..11:00 (5 slots); BST so UTC is 08:00..10:00
    expect(starts(query())).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
  });
  it("aligns slots to the clock grid, not the start of working hours", () => {
    const q = query({ slotIntervalMinutes: 15, staff: [staff("a", { workingHours: hours(2, [550, 720]) })] }); // 09:10
    expect(starts(q)[0]).toBe("08:15"); // 09:15 local
  });
  it("returns nothing on days with no working hours", () => {
    expect(computeSlots(query({ date: "2026-06-03" }))).toEqual([]); // Wednesday
  });
  it("does not offer a split day's lunch break", () => {
    const q = query({ staff: [staff("a", { workingHours: hours(2, [540, 720], [780, 960]) })] });
    const local = computeSlots(q).map((s) => s.start.getUTCHours() + 1 + ":" + String(s.start.getUTCMinutes()).padStart(2, "0"));
    expect(local).not.toContain("12:00");
    expect(local).not.toContain("12:30");
    expect(local).toContain("13:00");
    expect(local).toContain("14:00"); // 14:00-15:00 fits before 16:00
    expect(local).not.toContain("15:30"); // would end 16:30
  });
});

describe("existing bookings and buffers", () => {
  // Existing booking 10:00-11:00 local with a 10 min buffer after => blocked [09:00Z, 10:10Z)
  const existing = day("2026-06-02T09:00:00Z", "2026-06-02T10:10:00Z");
  it("blocks overlapping starts and honours the buffer after an existing booking", () => {
    const q = query({ slotIntervalMinutes: 5, staff: [staff("a", { workingHours: hours(2, [480, 780]), blocked: [existing] })] });
    const s = starts(q);
    expect(s).not.toContain("09:30"); // 10:30 local, inside the booking
    expect(s).not.toContain("10:05"); // 11:05 local, inside the 10 min buffer
    expect(s).toContain("10:10"); // 11:10 local, first free start
  });
  it("applies the new service's own buffers (adjacent is fine, overlapping is not)", () => {
    const base = { slotIntervalMinutes: 5, staff: [staff("a", { workingHours: hours(2, [480, 780]), blocked: [existing] })] };
    // no buffers: 08:50-09:50 local ends at 09:50, free; 09:00-10:00 also fine (ends exactly at 10:00)
    expect(starts(query({ ...base }))).toContain("08:00");
    // 10 min buffer after: 09:00 local slot would block until 10:10 and collide; 08:50 local still fits
    const buffered = query({ ...base, service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 10 } });
    expect(starts(buffered)).not.toContain("08:00"); // 09:00 local
    expect(starts(buffered)).toContain("07:50"); // 08:50 local: blocked ends 10:00 local == booking start
  });
  it("a buffer before the slot pushes it away from the previous booking", () => {
    const q = query({ slotIntervalMinutes: 5, staff: [staff("a", { workingHours: hours(2, [480, 780]), blocked: [existing] })],
      service: { durationMinutes: 30, bufferBeforeMinutes: 15, bufferAfterMinutes: 0 } });
    expect(starts(q)).not.toContain("10:10"); // blocked would start at 09:55Z, inside the old block
    expect(starts(q)).toContain("10:25");
  });
  it("lets buffers run past closing time; only the service must fit", () => {
    const q = query({ slotIntervalMinutes: 60, staff: [staff("a", { workingHours: hours(2, [540, 600]) })],
      service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 30 } });
    expect(starts(q)).toEqual(["08:00"]);
  });
});

describe("time off, notice and booking window", () => {
  it("removes slots during time off", () => {
    const off = day("2026-06-02T08:30:00Z", "2026-06-02T09:30:00Z"); // 09:30-10:30 local
    const s = starts(query({ staff: [staff("a", { timeOff: [off] })] }));
    // Time off is 09:30-10:30 local. 09:00, 09:30 and 10:00 local overlap it; 10:30 and 11:00 local are clear.
    expect(s).toEqual(["09:30", "10:00"]);
  });
  it("removes everything on a whole day off", () => {
    const off = day("2026-06-01T23:00:00Z", "2026-06-02T23:00:00Z");
    expect(computeSlots(query({ staff: [staff("a", { timeOff: [off] })] }))).toEqual([]);
  });
  it("respects minimum notice", () => {
    const now = new Date("2026-06-02T07:00:00Z"); // 08:00 local on the day
    expect(starts(query({ now, minNoticeMinutes: 90 }))[0]).toBe("08:30"); // earliest 09:30 local
  });
  it("returns nothing for past days or beyond the advance window", () => {
    expect(computeSlots(query({ now: new Date("2026-06-03T09:00:00Z") }))).toEqual([]);
    expect(computeSlots(query({ maxAdvanceDays: 10 }))).toEqual([]); // 2026-06-02 is 32 days after 2026-05-01
  });
  it("uses the business date, not the UTC date, for 'today'", () => {
    // 23:30Z on 1 Jun is 00:30 on 2 Jun in London; the 2 Jun slots are still bookable (09:00 local = 08:00Z)
    const now = new Date("2026-06-01T23:30:00Z");
    expect(starts(query({ now, minNoticeMinutes: 0 }))[0]).toBe("08:00");
  });
});

describe("clock changes (BST/GMT)", () => {
  const early = new Date("2026-03-01T00:00:00Z");
  const sunday = (date: string) => query({ date, now: early, maxAdvanceDays: 365, staff: [staff("a", { workingHours: hours(7, [540, 720]) })] });
  it("spring forward (Sun 29 Mar 2026): 09:00 local is 08:00Z", () => {
    expect(starts(sunday("2026-03-29"))[0]).toBe("08:00");
  });
  it("the day before, in GMT, 09:00 local is 09:00Z", () => {
    expect(starts(query({ date: "2026-03-28", now: early, maxAdvanceDays: 365, staff: [staff("a", { workingHours: hours(6, [540, 720]) })] }))[0]).toBe("09:00");
  });
  it("autumn back (Sun 25 Oct 2026): 09:00 local is 09:00Z", () => {
    expect(starts(sunday("2026-10-25"))[0]).toBe("09:00");
  });
  it("skips local times that do not exist, and keeps real durations", () => {
    expect(isValidLocalTime("2026-03-29", 90, TZ)).toBe(false); // 01:30 doesn't exist
    expect(isValidLocalTime("2026-03-29", 30, TZ)).toBe(true);
    const q = query({ date: "2026-03-29", now: early, maxAdvanceDays: 365, slotIntervalMinutes: 30, staff: [staff("a", { workingHours: hours(7, [0, 180]) })],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 } });
    const s = computeSlots(q).map((x) => x.start.toISOString().slice(11, 16));
    // local 00:00, 00:30, then 02:00 and 02:30 (01:xx doesn't exist); UTC 00:00, 00:30, 01:00, 01:30
    expect(s).toEqual(["00:00", "00:30", "01:00", "01:30"]);
    expect(computeSlots(q)[2].end.getTime() - computeSlots(q)[2].start.getTime()).toBe(30 * 60000);
  });
  it("isoWeekday", () => {
    expect(isoWeekday("2026-06-01")).toBe(1);
    expect(isoWeekday("2026-06-07")).toBe(7);
  });
});

describe("several staff ('any' staff)", () => {
  it("merges staff and lists the least busy person first", () => {
    const busy = staff("busy", { blocked: [day("2026-06-02T13:00:00Z", "2026-06-02T14:00:00Z"), day("2026-06-02T15:00:00Z", "2026-06-02T16:00:00Z")] });
    const free = staff("free");
    const slots = computeSlots(query({ staff: [busy, free] }));
    expect(slots).toHaveLength(5);
    expect(slots[0].staffIds).toEqual(["free", "busy"]);
  });
  it("offers a slot while at least one person is free", () => {
    const a = staff("a", { blocked: [day("2026-06-02T08:00:00Z", "2026-06-02T09:00:00Z")] });
    const b = staff("b");
    const first = computeSlots(query({ staff: [a, b] }))[0];
    expect(first.start.toISOString()).toBe("2026-06-02T08:00:00.000Z");
    expect(first.staffIds).toEqual(["b"]);
  });
  it("drops a slot when everyone is booked", () => {
    const blocked = [day("2026-06-02T08:00:00Z", "2026-06-02T09:00:00Z")];
    const s = starts(query({ staff: [staff("a", { blocked }), staff("b", { blocked })] }));
    expect(s).not.toContain("08:00");
    expect(s).not.toContain("08:30");
  });
});

describe("findAvailableDates and input checks", () => {
  it("lists only days with slots", () => {
    const { date: _d, ...rest } = query({ staff: [staff("a", { workingHours: hours(1, [540, 720]) })] }); // Mondays
    void _d;
    expect(findAvailableDates(rest, "2026-06-01", 15)).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
  });
  it("rejects bad dates and intervals", () => {
    expect(() => computeSlots(query({ date: "2026-02-30" }))).toThrow(RangeError);
    expect(() => computeSlots(query({ slotIntervalMinutes: 0 }))).toThrow(RangeError);
  });
});
