import { WEEKDAYS } from "./hours";

export type StaffHourRow = { weekday: number; start_minute: number; end_minute: number };
export type OpeningDay = { weekday: number; day: string; ranges: { start: number; end: number }[] };

/** The shop is open when at least one active team member works: each day's ranges are the merged ranges of everyone. */
export function openingTimes(rows: StaffHourRow[]): OpeningDay[] {
  return WEEKDAYS.map((day, i) => {
    const weekday = i + 1;
    const sorted = rows.filter((r) => r.weekday === weekday).map((r) => ({ start: r.start_minute, end: r.end_minute })).sort((a, b) => a.start - b.start);
    const ranges: { start: number; end: number }[] = [];
    for (const r of sorted) {
      const last = ranges[ranges.length - 1];
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else ranges.push({ ...r });
    }
    return { weekday, day, ranges };
  });
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "08:00 – 12:00, 13:00 – 17:00", or "Closed". */
export function rangesText(ranges: { start: number; end: number }[]): string {
  return ranges.length ? ranges.map((r) => `${hhmm(r.start)} – ${hhmm(r.end)}`).join(", ") : "Closed";
}

/** Days with the same hours are shown together: "Monday – Friday". Only runs of consecutive days are joined. */
export function groupedOpeningTimes(days: OpeningDay[]): { label: string; text: string }[] {
  const out: { first: string; last: string; text: string }[] = [];
  for (const d of days) {
    const text = rangesText(d.ranges);
    const prev = out[out.length - 1];
    if (prev && prev.text === text) prev.last = d.day;
    else out.push({ first: d.day, last: d.day, text });
  }
  return out.map((g) => ({ label: g.first === g.last ? g.first : `${g.first} – ${g.last}`, text: g.text }));
}
