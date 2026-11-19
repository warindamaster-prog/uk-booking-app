import { addDaysYmd, zonedToUtc } from "./time";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** ?month=YYYY-MM, falling back to the current month for anything invalid. */
export function parseMonth(raw: string | undefined, today: string): string {
  return raw && MONTH_RE.test(raw) ? raw : today.slice(0, 7);
}

export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** ISO weekday of a local date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** All dates in the month, plus how many empty cells come first when weeks start on Monday. */
export function monthDays(ym: string): { days: string[]; leadingBlanks: number } {
  const first = `${ym}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(ym); d = addDaysYmd(d, 1)) days.push(d);
  return { days, leadingBlanks: isoWeekday(first) - 1 };
}

export function monthLabel(ym: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "long", year: "numeric" }).format(zonedToUtc(`${ym}-15`, 12 * 60, tz));
}

/** UTC bounds [from, to) of the whole local month. */
export function monthBounds(ym: string, tz: string): { from: Date; to: Date } {
  return { from: zonedToUtc(`${ym}-01`, 0, tz), to: zonedToUtc(`${shiftMonth(ym, 1)}-01`, 0, tz) };
}

export type DayStatus = "off" | "part_off" | "not_working" | "working";

/**
 * "off": time off covers the whole day. "part_off": some of it. "not_working": no regular hours on
 * that weekday. Otherwise "working".
 */
export function dayStatus(o: {
  day: string; tz: string; workingWeekdays: ReadonlySet<number>; timeOff: { starts_at: string; ends_at: string }[];
}): DayStatus {
  const start = zonedToUtc(o.day, 0, o.tz).getTime();
  const end = zonedToUtc(addDaysYmd(o.day, 1), 0, o.tz).getTime();
  const overlaps = o.timeOff.filter((t) => new Date(t.starts_at).getTime() < end && new Date(t.ends_at).getTime() > start);
  if (overlaps.some((t) => new Date(t.starts_at).getTime() <= start && new Date(t.ends_at).getTime() >= end)) return "off";
  if (!o.workingWeekdays.has(isoWeekday(o.day))) return "not_working";
  return overlaps.length ? "part_off" : "working";
}
