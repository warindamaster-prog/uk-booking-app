import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { computeSlots, findAvailableDates } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { loadBookingContext } from "@/lib/booking/data";
import { allowedActions } from "@/lib/calendar";
import { fetchBooking } from "@/lib/dashboard/bookings";
import { formatTime, formatYmd, todayYmd } from "@/lib/time";
import { intlLocale } from "@/lib/i18n/core";
import { getLocale, getT } from "@/lib/i18n/server";
import { uuid } from "@/lib/validation/catalog";
import { z } from "zod";
import { RescheduleForm } from "./reschedule-form";

export const metadata: Metadata = { title: "Reschedule booking" };

const params = z.object({
  staff: z.uuid().optional().catch(undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  time: z.iso.datetime().optional().catch(undefined),
});

const pill = "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm";
const idle = "border-neutral-400";
const active = "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900";

export default async function ReschedulePage({ params: routeParams, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = uuid.safeParse((await routeParams).id);
  if (!id.success) notFound();
  const { supabase, business, role } = await requireBusiness();
  const t = await getT();
  const loc = intlLocale(await getLocale());
  const booking = await fetchBooking(supabase, business.id, id.data);
  if (!booking) notFound();
  if (!allowedActions(booking).reschedule) redirect(`/dashboard/bookings/${booking.id}`);

  const raw = await searchParams;
  const first = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const sp = params.parse({ staff: first("staff"), date: first("date"), time: first("time") });
  const staffId = role === "owner" && sp.staff ? sp.staff : booking.staff_id;
  const tz = business.timezone;
  const today = todayYmd(tz);

  const { data: full } = await supabase.from("bookings").select("buffer_before_minutes, buffer_after_minutes").eq("id", booking.id).maybeSingle();
  const ctx = await loadBookingContext(business, booking.service_id, staffId, today, 28, new Date(), {
    db: supabase, excludeBookingId: booking.id, minNoticeMinutes: 0, maxAdvanceDays: 365, allowInactiveService: true,
  });
  if (!ctx) {
    if (staffId !== booking.staff_id) redirect(`/dashboard/bookings/${booking.id}/reschedule`);
    return <main className="space-y-4"><p>{t("This booking can't be moved because nobody is set up to offer {service}.", { service: booking.service_name })}</p>
      <Link href={`/dashboard/bookings/${booking.id}`} className="underline">{t("Back to the booking")}</Link></main>;
  }
  // Keep the duration and buffers the booking was made with.
  const base = { ...ctx.base, service: {
    durationMinutes: booking.duration_minutes,
    bufferBeforeMinutes: full?.buffer_before_minutes ?? 0, bufferAfterMinutes: full?.buffer_after_minutes ?? 0 } };

  const dates = findAvailableDates(base, today, 28);
  const date = sp.date && dates.includes(sp.date) ? sp.date : dates[0];
  const slots = date ? computeSlots({ ...base, date }) : [];
  const chosen = sp.time ? slots.find((s) => s.start.toISOString() === new Date(sp.time!).toISOString()) : undefined;

  const root = `/dashboard/bookings/${booking.id}/reschedule`;
  const href = (o: { staff?: string; date?: string; time?: string }) => {
    const q = new URLSearchParams();
    const st = o.staff ?? staffId;
    if (st !== booking.staff_id) q.set("staff", st);
    if (o.date) q.set("date", o.date);
    if (o.time) q.set("time", o.time);
    return q.toString() ? `${root}?${q}` : root;
  };

  return (
    <main className="space-y-8">
      <p><Link href={`/dashboard/bookings/${booking.id}`} className="text-sm underline">{t("← Back to the booking")}</Link></p>
      <div>
        <h1 className="text-2xl font-semibold">{t("Reschedule")}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("{service} for {customer}. The price and details stay the same.", { service: booking.service_name, customer: booking.customer?.name ?? t("the customer") })}
        </p>
      </div>

      {role === "owner" && ctx.staffOptions.length > 1 && (
        <section aria-labelledby="who-h">
          <h2 id="who-h" className="mb-2 font-medium">{t("With")}</h2>
          <ul className="flex flex-wrap gap-2">
            {ctx.staffOptions.map((s) => (
              <li key={s.id}><Link href={href({ staff: s.id, date })} aria-current={staffId === s.id ? "true" : undefined}
                className={`${pill} ${staffId === s.id ? active : idle}`}>{s.name}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {!dates.length ? <p role="status">{t("There are no free times in the next 28 days for this person.")}</p> : (
        <>
          <section aria-labelledby="date-h">
            <h2 id="date-h" className="mb-2 font-medium">{t("New day")}</h2>
            <ul className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((d) => (
                <li key={d} className="shrink-0"><Link href={href({ date: d })} aria-current={d === date ? "date" : undefined}
                  className={`${pill} ${d === date ? active : idle}`}>{formatYmd(d, tz, loc)}</Link></li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="time-h">
            <h2 id="time-h" className="mb-2 font-medium">{date ? t("New time on {date}", { date: formatYmd(date, tz, loc) }) : t("New time")}</h2>
            <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">{t("Times are UK time.")}</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const iso = s.start.toISOString();
                const on = chosen?.start.toISOString() === iso;
                return <li key={iso}><Link href={href({ date, time: iso })} aria-current={on ? "true" : undefined}
                  className={`${pill} w-full ${on ? active : idle}`}>{formatTime(s.start, tz, loc)}</Link></li>;
              })}
            </ul>
          </section>
          {chosen && <RescheduleForm id={booking.id} staff={staffId} startsAt={chosen.start.toISOString()}
            label={t("{date} at {time}", { date: formatYmd(date!, tz, loc), time: formatTime(chosen.start, tz, loc) })} />}
        </>
      )}
    </main>
  );
}
