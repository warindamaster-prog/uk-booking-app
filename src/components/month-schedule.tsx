import Link from "next/link";
import { BookingCard } from "@/components/booking-card";
import { groupByLocalDay } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES, type BookingView } from "@/lib/dashboard/bookings";
import { dayStatus, monthBounds, monthDays, monthLabel, parseMonth, shiftMonth, type DayStatus } from "@/lib/schedule";
import { formatTime, formatYmd, isValidYmd, todayYmd } from "@/lib/time";
import type { requireBusiness } from "@/lib/auth";
import { intlLocale } from "@/lib/i18n/core";
import { getLocale, getT } from "@/lib/i18n/server";

type Ctx = Awaited<ReturnType<typeof requireBusiness>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_TEXT: Record<DayStatus, string | null> = { off: "Day off", part_off: "Part day off", not_working: "Not working", working: null };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SCHEDULE_ANCHOR = "month-schedule";

/**
 * The whole month at a glance: every booking (past and upcoming, not cancelled) for everyone,
 * or for one team member. Owners can pick a person; a staff member only sees their own.
 */
export async function MonthSchedule({ ctx, params, publicUrl }: { ctx: Ctx; params: { month?: string; staff?: string; day?: string }; publicUrl: string }) {
  const { supabase, business, role, user } = ctx;
  const t = await getT();
  const loc = intlLocale(await getLocale());
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

  const selectedDay = params.day && isValidYmd(params.day) && days.includes(params.day) ? params.day : days.includes(today) ? today : days[0];
  const qs = (m: string, day?: string) => `?month=${m}${picked && role === "owner" ? `&staff=${picked.id}` : ""}${day ? `&day=${day}` : ""}#${SCHEDULE_ANCHOR}`;
  const dayHref = (d: string) => `/dashboard/calendar?view=day&date=${d}${picked ? `&staff=${picked.id}` : ""}`;
  const pill = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#e1e7d8] bg-white px-3 text-sm font-medium text-[#415044] hover:bg-[#f2f5ed]";
  const selectedRows: BookingView[] = byDay.get(selectedDay) ?? [];
  const todayRows: BookingView[] = byDay.get(today) ?? [];

  const cell = (d: string, i: number) => {
    const items: BookingView[] = byDay.get(d) ?? [];
    const st = statusOf(d);
    const away = offNames(d);
    const sel = d === selectedDay;
    return (
      <Link key={d} href={qs(month, d)} scroll={false} role="gridcell" aria-current={sel ? "date" : undefined}
        aria-label={`${formatYmd(d, tz, loc)}, ${items.length}`}
        className={`relative flex min-h-[76px] min-w-0 flex-col items-start border-t border-[#e9ede1] p-1.5 text-left md:min-h-[96px] md:p-2 ${(leadingBlanks + i) % 7 !== 6 ? "border-r" : ""} ${sel ? "bg-[#f1f5e9] ring-1 ring-inset ring-[#9bb27e]" : "hover:bg-[#f7f9f1]"} ${st === "off" || st === "not_working" ? "opacity-70" : ""}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${d === today ? "bg-[#385e3a] font-semibold text-white" : sel ? "bg-[#e1ebce] font-semibold text-[#476638]" : ""}`}>
          {Number(d.slice(8))}{d === today && <span className="sr-only"> ({t("today")})</span>}
        </span>
        {STATUS_TEXT[st] && <span className="mt-1 w-full truncate rounded bg-[#f2f0e6] px-1 text-[11px]">{t(STATUS_TEXT[st]!)}</span>}
        {away.slice(0, 1).map((n) => <span key={n} className="mt-1 w-full truncate rounded bg-[#f2f0e6] px-1 text-[11px]">{t("{name} off", { name: n })}</span>)}
        {items.slice(0, 1).map((b) => (
          <span key={b.id} className="mt-1 w-full truncate rounded border-l-2 border-[#7d9a5c] bg-[#e5edda] px-1 py-1 text-xs font-medium text-[#49633c]">
            <span className="block">{formatTime(b.starts_at, tz, loc)}</span>
            <span className="hidden truncate md:block">{b.customer?.name ?? t("Customer")}</span>
          </span>
        ))}
        {items.length > 1 && <span className="mt-1 text-xs text-[#5e7450]">{t("+{n} more", { n: items.length - 1 })}</span>}
      </Link>
    );
  };

  return (
    <section id={SCHEDULE_ANCHOR} aria-labelledby="schedule-h" className="scroll-mt-4 space-y-4">
      {role === "owner" && people.length > 1 && (
        <form method="get" action={`/dashboard#${SCHEDULE_ANCHOR}`} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="month" value={month} />
          <div className="space-y-1">
            <label htmlFor="staff" className="block text-sm font-medium">{t("Show bookings for")}</label>
            <select id="staff" name="staff" defaultValue={picked?.id ?? "all"} className="block min-h-11 rounded-lg border border-[#dce3d7] bg-white px-3 text-base">
              <option value="all">{t("Everyone")}</option>
              {people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button type="submit" className={pill}>{t("Show")}</button>
        </form>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe5d6] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebdf] px-5 py-4">
            <div>
              <h2 id="schedule-h" className="text-lg font-semibold tracking-[-.4px]">{monthLabel(month, tz, loc)}</h2>
              <p className="mt-1 text-xs text-[#6e7b62]">
                {t(rows.length === 1 ? "1 booking" : "{n} bookings", { n: rows.length })}{picked ? ` · ${picked.name}` : ""} · {t("Times are UK time.")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link href={qs(shiftMonth(month, -1))} className={`${pill} w-11`} aria-label={t("Previous month")} scroll={false}>←</Link>
              <Link href={qs(today.slice(0, 7))} className={pill} scroll={false}>{t("This month")}</Link>
              <Link href={qs(shiftMonth(month, 1))} className={`${pill} w-11`} aria-label={t("Next month")} scroll={false}>→</Link>
            </div>
          </div>
          <div role="grid" aria-label={t("{month} bookings", { month: monthLabel(month, tz, loc) })}>
            <div className="grid grid-cols-7 bg-[#fafbf6]">
              {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="py-3 text-center text-xs font-medium uppercase text-[#758268]">{t(w)}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: leadingBlanks }, (_, i) => <div key={`b${i}`} className={`min-h-[76px] border-t border-r border-[#e9ede1] bg-[#fafbf7] md:min-h-[96px]`} />)}
              {days.map((d, i) => cell(d, i))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ebdf] px-5 py-3 text-xs text-[#6f7b64]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#88a360]" />{t("Confirmed booking")}</span>
            <span>{t("Select a day to see its bookings")}</span>
          </div>
        </div>

        <div className="space-y-5">
          <section aria-labelledby="today-h" className="rounded-2xl border border-[#e0e6d7] bg-white">
            <div className="flex items-center justify-between border-b border-[#ebeee4] px-5 py-4">
              <h2 id="today-h" className="text-base font-semibold">{t("Today's schedule")}</h2>
              <span className="rounded-md bg-[#eff3e6] px-2 py-1 text-xs text-[#647b4e]">{todayRows.length}</span>
            </div>
            {todayRows.length ? (
              <ul className="space-y-3 p-4">{todayRows.map((b) => <li key={b.id}><BookingCard b={b} tz={tz} showStaff={role === "owner"} compact /></li>)}</ul>
            ) : (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f4eb] text-[#6a8259]">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></svg>
                </span>
                <h3 className="text-base font-semibold">{t("A little breathing room.")}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#6c776a]">{t("No bookings today. A good moment to get ready for what's next.")}</p>
                <Link href="/dashboard/calendar" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#55713e]">{t("Open the schedule")} →</Link>
              </div>
            )}
          </section>

          <section aria-labelledby="sel-h" className="rounded-2xl border border-[#e0e6d7] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 id="sel-h" className="text-sm font-semibold"><Link href={dayHref(selectedDay)} className="underline-offset-4 hover:underline">{formatYmd(selectedDay, tz, loc)}</Link></h2>
              <span className="text-xs text-[#748267]">{t("Selected day")}</span>
            </div>
            <div className="mt-4 space-y-3">
              {selectedRows.length
                ? selectedRows.map((b) => <BookingCard key={b.id} b={b} tz={tz} showStaff={role === "owner" && everyone} compact />)
                : <p className="py-4 text-sm text-[#6d7a61]">{t("No bookings on this day.")}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#dce5ca] bg-[#edf2e1] p-5">
            <h2 className="text-sm font-semibold">{t("Your booking link")}</h2>
            <p className="mt-2 text-sm leading-6 text-[#657854]">{t("One link. A simpler way for customers to find you.")}</p>
            <p className="mt-3 break-all rounded-lg border border-[#dce5cb] bg-[#f9fbf3] p-3 text-xs text-[#587344]">{publicUrl}</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#4a6736]">{t("Preview booking page")} ↗</a>
          </section>
        </div>
      </div>
    </section>
  );
}
