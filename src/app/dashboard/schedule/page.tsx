import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { groupByLocalDay } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES, type BookingView } from "@/lib/dashboard/bookings";
import { dayStatus, monthBounds, monthDays, monthLabel, parseMonth, shiftMonth, type DayStatus } from "@/lib/schedule";
import { formatTime, formatYmd, todayYmd } from "@/lib/time";

export const metadata: Metadata = { title: "See schedule" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_TEXT: Record<DayStatus, string | null> = { off: "Day off", part_off: "Part day off", not_working: "Not working", working: null };

export default async function SchedulePage({ searchParams }: Props) {
  const { supabase, business, role, user } = await requireBusiness();
  const tz = business.timezone;
  const raw = await searchParams;
  const first = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const today = todayYmd(tz);
  const month = parseMonth(first("month"), today);

  // Owners pick anyone; a staff member only ever sees their own schedule.
  const { data: all } = await supabase.from("staff").select("id, name, user_id").eq("business_id", business.id).eq("active", true)
    .order("sort_order").order("name");
  const people = (all ?? []).filter((s) => role === "owner" || s.user_id === user.id);
  const wanted = first("staff");
  const person = people.find((s) => s.id === wanted && UUID.test(wanted ?? "")) ?? people[0];

  if (!person) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">See schedule</h1>
        <p>There is nobody to show yet. Add a team member on the Staff page.</p>
      </main>
    );
  }

  const { from, to } = monthBounds(month, tz);
  const [{ rows }, hours, off] = await Promise.all([
    fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, staffId: person.id, statuses: LIVE_STATUSES }),
    supabase.from("working_hours").select("weekday").eq("staff_id", person.id),
    supabase.from("time_off").select("starts_at, ends_at").eq("staff_id", person.id)
      .lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  const weekdays = new Set((hours.data ?? []).map((h) => h.weekday as number));
  const byDay = groupByLocalDay(rows, tz);
  const { days, leadingBlanks } = monthDays(month);
  const statusOf = (d: string) => dayStatus({ day: d, tz, workingWeekdays: weekdays, timeOff: off.data ?? [] });

  const link = (m: string, staff = person.id) => `/dashboard/schedule?month=${m}&staff=${staff}`;
  const dayHref = (d: string) => `/dashboard/calendar?view=day&date=${d}&staff=${person.id}`;
  const pill = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-3 py-2 text-sm";

  const cell = (d: string, max: number) => {
    const items: BookingView[] = byDay.get(d) ?? [];
    const st = statusOf(d);
    return (
      <div className={`space-y-1 ${st === "off" || st === "not_working" ? "opacity-70" : ""}`}>
        <p className="flex items-baseline justify-between gap-1 text-xs">
          <Link href={dayHref(d)} className="font-medium underline">{Number(d.slice(8))}{d === today && <span className="sr-only"> (today)</span>}</Link>
          {d === today && <span aria-hidden className="rounded bg-neutral-900 px-1 text-[10px] text-white dark:bg-white dark:text-neutral-900">today</span>}
        </p>
        {STATUS_TEXT[st] && <p className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">{STATUS_TEXT[st]}</p>}
        {items.slice(0, max).map((b) => (
          <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="block truncate rounded border border-neutral-300 px-1 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
            {formatTime(b.starts_at, tz)} {b.customer?.name ?? "Customer"}
          </Link>
        ))}
        {items.length > max && <Link href={dayHref(d)} className="block text-[11px] underline">+{items.length - max} more</Link>}
      </div>
    );
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">See schedule</h1>

      <form method="get" action="/dashboard/schedule" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="month" value={month} />
        {role === "owner" && people.length > 1 ? (
          <div className="space-y-1">
            <label htmlFor="staff" className="block text-sm font-medium">Team member</label>
            <select id="staff" name="staff" defaultValue={person.id} className="block rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
              {people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <>
            <input type="hidden" name="staff" value={person.id} />
            <p className="text-sm">Showing <strong>{person.name}</strong></p>
          </>
        )}
        {role === "owner" && people.length > 1 && <button type="submit" className={pill}>Show</button>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={link(shiftMonth(month, -1))} className={pill} aria-label="Previous month">← Previous</Link>
        <Link href={link(today.slice(0, 7))} className={pill}>This month</Link>
        <Link href={link(shiftMonth(month, 1))} className={pill} aria-label="Next month">Next →</Link>
      </div>

      <h2 className="text-xl font-semibold">{monthLabel(month, tz)} · {person.name}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {rows.length} booking{rows.length === 1 ? "" : "s"} this month. Times are UK time. Tap a date for the full day, or a booking to open it.
      </p>

      {/* Phones: a list of days that have something on. Wider screens: the month grid. */}
      <ul className="space-y-3 sm:hidden" aria-label="Days with bookings or time off">
        {days.filter((d) => (byDay.get(d)?.length ?? 0) > 0 || statusOf(d) === "off" || statusOf(d) === "part_off").map((d) => (
          <li key={d} className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
            <p className="mb-1 text-sm font-medium">{formatYmd(d, tz)}{d === today && " (today)"}</p>
            {cell(d, 20)}
          </li>
        ))}
        {!rows.length && !days.some((d) => ["off", "part_off"].includes(statusOf(d))) && <li className="text-sm">Nothing this month.</li>}
      </ul>

      <div className="hidden sm:block">
        <div role="grid" aria-label={`${monthLabel(month, tz)} schedule for ${person.name}`} className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-300 bg-neutral-300 dark:border-neutral-700 dark:bg-neutral-700">
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
    </main>
  );
}
