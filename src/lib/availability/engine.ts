// Availability engine: pure functions, no database or clock access.
// The caller loads the data (see AvailabilityQuery) and passes `now` in.
//
// Rules (they mirror the database constraint `no_double_booking`):
//  - a slot's service time must fit inside one of the staff member's working ranges;
//  - the slot's blocked range [start - bufferBefore, end + bufferAfter) must not
//    overlap any existing live booking's blocked range (half-open intervals);
//  - the service time must not overlap time off;
//  - the start must be at least `minNoticeMinutes` away and within `maxAdvanceDays`.
// Buffers may extend outside working hours; only the service itself must fit.
// Callers pass only LIVE bookings: confirmed/completed/no_show, plus pending_payment
// holds that haven't expired. Cancelled and expired bookings must not be passed in.

import { addDaysYmd, isValidLocalTime, isValidYmd, todayYmd, zonedToUtc } from "../time";

export type Interval = { start: Date; end: Date };

export type StaffDay = {
  id: string;
  /** weekday is ISO (1 = Monday); start/end are local minutes after midnight. */
  workingHours: { weekday: number; start: number; end: number }[];
  timeOff: Interval[];
  /** Blocked ranges (buffers included) of this person's live bookings. */
  blocked: Interval[];
};

export type ServiceTiming = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type AvailabilityQuery = {
  tz: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  now: Date;
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  service: ServiceTiming;
  /** Only staff who are active and offer this service. */
  staff: StaffDay[];
};

export type Slot = {
  start: Date;
  end: Date;
  /** Staff free for this slot, least busy that day first, then input order. */
  staffIds: string[];
};

const MIN = 60_000;
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

export function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** UTC bounds of a local calendar day; use them to query bookings and time off. */
export function dayBounds(date: string, tz: string): Interval {
  return { start: zonedToUtc(date, 0, tz), end: zonedToUtc(addDaysYmd(date, 1), 0, tz) };
}

export function computeSlots(q: AvailabilityQuery): Slot[] {
  if (!isValidYmd(q.date)) throw new RangeError(`Invalid date: ${q.date}`);
  if (q.slotIntervalMinutes < 1) throw new RangeError("slotIntervalMinutes must be positive");

  const today = todayYmd(q.tz, q.now);
  if (q.date < today || q.date > addDaysYmd(today, q.maxAdvanceDays)) return [];

  const earliest = q.now.getTime() + q.minNoticeMinutes * MIN;
  const weekday = isoWeekday(q.date);
  const day = dayBounds(q.date, q.tz);
  const { durationMinutes: dur, bufferBeforeMinutes: before, bufferAfterMinutes: after } = q.service;

  const byStart = new Map<number, string[]>();
  const load = new Map<string, number>();
  const order = new Map<string, number>();

  q.staff.forEach((s, index) => {
    order.set(s.id, index);
    load.set(s.id, s.blocked.filter((b) => b.start >= day.start && b.start < day.end).length);

    for (const range of s.workingHours) {
      if (range.weekday !== weekday) continue;
      const rangeEnd = zonedToUtc(q.date, range.end, q.tz).getTime();
      const first = Math.ceil(range.start / q.slotIntervalMinutes) * q.slotIntervalMinutes;

      for (let t = first; t < range.end; t += q.slotIntervalMinutes) {
        if (!isValidLocalTime(q.date, t, q.tz)) continue; // skipped hour on clock-change day
        const start = zonedToUtc(q.date, t, q.tz).getTime();
        const end = start + dur * MIN;
        if (end > rangeEnd) break; // later starts only end later
        if (start < earliest) continue;

        if (s.timeOff.some((o) => overlaps(start, end, o.start.getTime(), o.end.getTime()))) continue;
        const bs = start - before * MIN;
        const be = end + after * MIN;
        if (s.blocked.some((b) => overlaps(bs, be, b.start.getTime(), b.end.getTime()))) continue;

        const list = byStart.get(start) ?? [];
        list.push(s.id);
        byStart.set(start, list);
      }
    }
  });

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, ids]) => ({
      start: new Date(start),
      end: new Date(start + dur * MIN),
      staffIds: ids.sort((a, b) => (load.get(a)! - load.get(b)!) || (order.get(a)! - order.get(b)!)),
    }));
}

/** Local dates in [from, from + days) that have at least one slot (for the date picker). */
export function findAvailableDates(q: Omit<AvailabilityQuery, "date">, from: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(from, i);
    if (computeSlots({ ...q, date }).length > 0) out.push(date);
  }
  return out;
}
