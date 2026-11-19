import type { Metadata } from "next";
import Link from "next/link";
import { BookingCard } from "@/components/booking-card";
import { requireBusiness } from "@/lib/auth";
import { groupByLocalDay, parseCalendarParams, rangeFor, shiftDate, type CalendarView } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES } from "@/lib/dashboard/bookings";
import { addDaysYmd, formatYmd, todayYmd, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Schedule" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CalendarPage({ searchParams }: Props) {
  const { supabase, business, role } = await requireBusiness();
  const tz = business.timezone;
  const raw = await searchParams;
  const first = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const today = todayYmd(tz);
  const p = parseCalendarParams({ view: first("view"), date: first("date"), staff: first("staff") }, today);
  const { days, from, to } = rangeFor(p.view, p.date, tz);

  const [staffRes, { rows }, off] = await Promise.all([
    supabase.from("staff").select("id, name").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
    fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, staffId: p.staff === "all" ? undefined : p.staff, statuses: LIVE_STATUSES }),
    supabase.from("time_off").select("staff_id, starts_at, ends_at").eq("business_id", business.id)
      .lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  const staff = staffRes.data ?? [];
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const byDay = groupByLocalDay(rows, tz);

  const href = (o: { view?: CalendarView; date?: string; staff?: string }) => {
    const q = new URLSearchParams({ view: o.view ?? p.view, date: o.date ?? p.date });
    const st = o.staff ?? p.staff;
    if (st !== "all") q.set("staff", st);
    return `/dashboard/calendar?${q}`;
  };
  const timeOffOn = (day: string) => {
    const s = zonedToUtc(day, 0, tz).getTime(), e = zonedToUtc(addDaysYmd(day, 1), 0, tz).getTime();
    return (off.data ?? []).filter((o) => new Date(o.starts_at).getTime() < e && new Date(o.ends_at).getTime() > s
      && (p.staff === "all" || o.staff_id === p.staff));
  };
  const title = p.view === "week" ? `${formatYmd(days[0], tz)} to ${formatYmd(days[6], tz)}` : formatYmd(p.date, tz);
  const pill = "inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm";
  const on = "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900";

  const dayBlock = (day: string, compact: boolean) => {
    const items = byDay.get(day) ?? [];
    const away = timeOffOn(day);
    return (
      <div className="space-y-2">
        {away.map((o, i) => <p key={i} className="rounded-md bg-neutral-100 p-2 text-sm dark:bg-neutral-800">{staffName.get(o.staff_id) ?? "Someone"} is off</p>)}
        {items.length ? items.map((b) => <BookingCard key={b.id} b={b} tz={tz} showStaff={role === "owner" && p.staff === "all"} compact={compact} />)
          : !away.length && <p className="text-sm text-neutral-600 dark:text-neutral-400">No bookings.</p>}
      </div>
    );
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Schedule</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ date: shiftDate(p.view, p.date, -1) })} className={pill} aria-label={`Previous ${p.view}`}>← Previous</Link>
        <Link href={href({ date: today })} className={pill}>Today</Link>
        <Link href={href({ date: shiftDate(p.view, p.date, 1) })} className={pill} aria-label={`Next ${p.view}`}>Next →</Link>
        <span className="mx-1" />
        <Link href={href({ view: "day" })} aria-current={p.view === "day" ? "true" : undefined} className={`${pill} ${p.view === "day" ? on : ""}`}>Day</Link>
        <Link href={href({ view: "week" })} aria-current={p.view === "week" ? "true" : undefined} className={`${pill} ${p.view === "week" ? on : ""}`}>Week</Link>
      </div>

      {role === "owner" && staff.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Show bookings for">
          {[{ id: "all", name: "Everyone" }, ...staff].map((s) => (
            <li key={s.id}><Link href={href({ staff: s.id })} aria-current={p.staff === s.id ? "true" : undefined} className={`${pill} ${p.staff === s.id ? on : ""}`}>{s.name}</Link></li>
          ))}
        </ul>
      )}

      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Times are UK time. Cancelled bookings are on the Bookings page.</p>

      {p.view === "day" ? dayBlock(p.date, false) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d} aria-labelledby={`d-${d}`} className="space-y-2">
              <h3 id={`d-${d}`} className="font-medium">
                <Link href={href({ view: "day", date: d })} className="underline">{formatYmd(d, tz)}</Link>
                {d === today && <span className="ml-1 text-xs">(today)</span>}
              </h3>
              {dayBlock(d, true)}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
