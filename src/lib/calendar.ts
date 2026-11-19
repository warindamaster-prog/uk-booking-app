import { addDaysYmd, isValidYmd, todayYmd, zonedToUtc } from "./time";

export type CalendarView = "day" | "week";

export type CalendarParams = { view: CalendarView; date: string; staff: string };

const STAFF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads and sanitises ?view=&date=&staff=. Anything invalid falls back to today / day / all. */
export function parseCalendarParams(
  raw: { view?: string; date?: string; staff?: string }, today: string,
): CalendarParams {
  return {
    view: raw.view === "week" ? "week" : "day",
    date: raw.date && isValidYmd(raw.date) ? raw.date : today,
    staff: raw.staff && STAFF_RE.test(raw.staff) ? raw.staff : "all",
  };
}

/** The Monday of the week containing `ymd`. */
export function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const iso = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  return addDaysYmd(ymd, 1 - iso);
}

export function weekDays(ymd: string): string[] {
  const start = weekStart(ymd);
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
}

/** UTC bounds [from, to) and the local dates covered by a day or week view. */
export function rangeFor(view: CalendarView, date: string, tz: string) {
  const days = view === "week" ? weekDays(date) : [date];
  return {
    days,
    from: zonedToUtc(days[0], 0, tz),
    to: zonedToUtc(addDaysYmd(days[days.length - 1], 1), 0, tz),
  };
}

export function shiftDate(view: CalendarView, date: string, direction: -1 | 1): string {
  return addDaysYmd(date, direction * (view === "week" ? 7 : 1));
}

/** Groups items by the local calendar day they start on, earliest first within each day. */
export function groupByLocalDay<T extends { starts_at: string | Date }>(items: T[], tz: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  for (const item of sorted) {
    const day = todayYmd(tz, new Date(item.starts_at));
    out.set(day, [...(out.get(day) ?? []), item]);
  }
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Awaiting deposit",
  cancelled: "Cancelled",
  expired: "Expired",
  no_show: "No-show",
  completed: "Completed",
};

/**
 * The status to show people. A confirmed booking whose time has passed reads as "completed" without
 * anyone having to mark it. Only the display changes: the stored status (and what can be done to the
 * booking, such as marking a no-show) still follows the real value.
 */
export function displayStatus(b: { status: string; ends_at?: string | Date | null; starts_at: string | Date }, now: Date = new Date()): string {
  const end = new Date(b.ends_at ?? b.starts_at);
  return b.status === "confirmed" && end <= now ? "completed" : b.status;
}

/** What can be done to a booking right now (mirrors the database rules; the database is the judge). */
export function allowedActions(b: { status: string; starts_at: string | Date }, now: Date = new Date()) {
  const started = new Date(b.starts_at) <= now;
  const live = b.status === "confirmed" || b.status === "pending_payment";
  return {
    cancel: live && !started,
    reschedule: live && !started,
    markNoShow: b.status === "confirmed" && started,
    undoNoShow: b.status === "no_show",
  };
}
