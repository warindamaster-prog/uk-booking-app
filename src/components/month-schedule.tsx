import Link from "next/link";
import { displayStatus, groupByLocalDay, STATUS_LABEL } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES, type BookingView } from "@/lib/dashboard/bookings";
import { dayStatus, monthBounds, monthDays, monthLabel, parseMonth, shiftMonth, type DayStatus } from "@/lib/schedule";
import { formatTime, formatYmd, todayYmd } from "@/lib/time";
import type { requireBusiness } from "@/lib/auth";

type Ctx = Awaited<ReturnType<typeof requireBusiness>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_TEXT: Record<DayStatus, string | null> = { off: "Day off", part_off: "Part day off", not_working: "Not working", working: null };
export const SCHEDULE_ANCHOR = "month-schedule";

/**
 * The whole month at a glance: every booking (past and upcoming, not cancelled) for everyone,
 * or for one team member. Owners can pick a person; a staff member only sees their own.
 */
export async function MonthSchedule({ ctx, params }: { ctx: Ctx; params: { month?: string; staff?: string } }) {
  const { supabase, business, role, user } = ctx;
  const tz = business.timezone;
  const today = todayYmd(tz);
  const month = parseMonth(params.month, today);

  const { data: all } = await supabase.from("staff").select("id, name, user_id").eq("business_id", business.id).eq("active", true)
    .order("sort_order").order("name");
  const people = (all ?? []).filter((s) => role === "owner" || s.user_id === user.id);
  const mine = role !== "owner" ? people[0] : undefined;
  const picked = mine ?? people.find((s) => s.id === params.staff && UUID.test(params.staff ?? ""));
  const everyone = !picked;

  const { from, to } = monthBounds(month, tz);
  const [{ rows }, hours, off] = await Promise.all([
    fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, staffId: picked?.id, statuses: LIVE_STATUSES }),
    picked ? supabase.from("working_hours").select("weekday").eq("staff_id", picked.id) : Promise.resolve({ data: [] as { weekday: number }[] }),
    supabase.from("time_off").select("staff_id, starts_at, ends_at").eq("business_id", business.id)
      .lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  const weekdays = new Set((hours.data ?? []).map((h) => h.weekday as number));
  const nameOf = new Map(people.map((s) => [s.id, s.name]));
  const timeOff = (off.data ?? []).filter((o) => (picked ? o.staff_id === picked.id : nameOf.has(o.staff_id)));
  const byDay = groupByLocalDay(rows, tz);
  const { days, leadingBlanks } = monthDays(month);

  const statusOf = (d: string): DayStatus => picked
    ? dayStatus({ day: d, tz, workingWeekdays: weekdays, timeOff: timeOff.filter((o) => o.staff_id === picked.id) })
    : "working";
  /** In the "everyone" view: who is off the whole day. */
  const offNames = (d: string): string[] => everyone
    ? people.filter((p) => dayStatus({ day: d, tz, workingWeekdays: new Set([1, 2, 3, 4, 5, 6, 7]), timeOff: timeOff.filter((o) => o.staff_id === p.id) }) === "off").map((p) => p.name)
    : [];

  const q = (m: string) => `?month=${m}${picked && role === "owner" ? `&staff=${picked.id}` : ""}#${SCHEDULE_ANCHOR}`;
  const dayHref = (d: string) => `/dashboard/calendar?view=day&date=${d}${picked ? `&staff=${picked.id}` : ""}`;
  const pill = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-3 py-2 text-sm";
  const busy = (d: string) => (byDay.get(d)?.length ?? 0) > 0 || ["off", "part_off"].includes(statusOf(d)) || offNames(d).length > 0;

  const cell = (d: string, max: number) => {
    const items: BookingView[] = byDay.get(d) ?? [];
    const st = statusOf(d);
    const away = offNames(d);
    return (
      <div className={`space-y-1 ${st === "off" || st === "not_working" ? "opacity-70" : ""}`}>
        <p className="flex items-baseline justify-between gap-1 text-xs">
          <Link href={dayHref(d)} className="font-medium underline">{Number(d.slice(8))}{d === today && <span className="sr-only"> (today)</span>}</Link>
          {d === today && <span aria-hidden className="rounded bg-neutral-900 px-1 text-[10px] text-white dark:bg-white dark:text-neutral-900">today</span>}
        </p>
        {STATUS_TEXT[st] && <p className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">{STATUS_TEXT[st]}</p>}
        {away.map((n) => <p key={n} className="truncate rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">{n} off</p>)}
        {items.slice(0, max).map((b) => (
          <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
            className="block truncate rounded border border-neutral-300 px-1 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
            {formatTime(b.starts_at, tz)} {b.customer?.name ?? "Customer"}
            {everyone && ` · ${b.staffName}`}
            {displayStatus(b) !== "confirmed" && ` (${(STATUS_LABEL[displayStatus(b)] ?? displayStatus(b)).toLowerCase()})`}
          </Link>
        ))}
        {items.length > max && <Link href={dayHref(d)} className="block text-[11px] underline">+{items.length - max} more</Link>}
      </div>
    );
  };

  return (
    <section id={SCHEDULE_ANCHOR} aria-labelledby="schedule-h" className="space-y-4 scroll-mt-4">
      <h2 id="schedule-h" className="text-xl font-semibold">{monthLabel(month, tz)}</h2>

      <div className="flex flex-wrap items-end gap-3">
        {role === "owner" && people.length > 1 && (
          <form method="get" action={`/dashboard#${SCHEDULE_ANCHOR}`} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="month" value={month} />
            <div className="space-y-1">
              <label htmlFor="staff" className="block text-sm font-medium">Show bookings for</label>
              <select id="staff" name="staff" defaultValue={picked?.id ?? "all"} className="block rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
                <option value="all">Everyone</option>
                {people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button type="submit" className={pill}>Show</button>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={q(shiftMonth(month, -1))} className={pill} aria-label="Previous month" scroll={false}>← Previous</Link>
          <Link href={q(today.slice(0, 7))} className={pill} scroll={false}>This month</Link>
          <Link href={q(shiftMonth(month, 1))} className={pill} aria-label="Next month" scroll={false}>Next →</Link>
        </div>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {rows.length} booking{rows.length === 1 ? "" : "s"} this month{picked ? ` for ${picked.name}` : ""}, including past ones. Cancelled bookings are on the Bookings page.
        Times are UK time. Tap a date for the full day, or a booking to open it.
      </p>

      {/* Phones: a list of days that have something on. Wider screens: the month grid. */}
      <ul className="space-y-3 sm:hidden" aria-label="Days with bookings or time off">
        {days.filter(busy).map((d) => (
          <li key={d} className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
            <p className="mb-1 text-sm font-medium">{formatYmd(d, tz)}{d === today && " (today)"}</p>
            {cell(d, 50)}
          </li>
        ))}
        {!days.some(busy) && <li className="text-sm">Nothing this month.</li>}
      </ul>

      <div className="hidden sm:block">
        <div role="grid" aria-label={`${monthLabel(month, tz)} bookings`}
          className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-300 bg-neutral-300 dark:border-neutral-700 dark:bg-neutral-700">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} role="columnheader" className="bg-neutral-100 p-1 text-center text-xs font-medium dark:bg-neutral-800">{w}</div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => <div key={`b${i}`} className="bg-white dark:bg-neutral-950" />)}
          {days.map((d) => (
            <div key={d} role="gridcell" className={`min-h-24 bg-white p-1 dark:bg-neutral-950 ${d === today ? "ring-2 ring-inset ring-neutral-900 dark:ring-white" : ""}`}>
              {cell(d, 3)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
