import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { computeSlots, findAvailableDates } from "@/lib/availability";
import { acceptsBookings, getBusinessBySlug, loadBookingContext, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { formatTime, formatYmd, todayYmd } from "@/lib/time";
import { bookPageParams } from "@/lib/validation/booking";
import { uuid } from "@/lib/validation/catalog";
import { PublicFooter, PublicHeader } from "../../chrome";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Choose a time" };

type Props = {
  params: Promise<{ slug: string; serviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pill = "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm";
const idle = "border-neutral-400";
const active = "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900";

export default async function BookPage({ params, searchParams }: Props) {
  const { slug, serviceId: sid } = await params;
  const serviceId = uuid.safeParse(sid);
  if (!serviceId.success) notFound();
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  if (!acceptsBookings(business)) redirect(`/b/${business.slug}`);

  const raw = await searchParams;
  const first = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const sp = bookPageParams.parse({ staff: first("staff"), date: first("date"), time: first("time") });

  const tz = business.timezone;
  const today = todayYmd(tz);
  const windowDays = Math.min(business.max_advance_days + 1, 28);
  const ctx = await loadBookingContext(business, serviceId.data, sp.staff, today, windowDays);
  if (!ctx) {
    if (sp.staff !== "any") redirect(`/b/${business.slug}/book/${serviceId.data}`);
    notFound();
  }
  const base = `/b/${business.slug}/book/${serviceId.data}`;
  const href = (p: { staff?: string; date?: string; time?: string }) => {
    const q = new URLSearchParams();
    if ((p.staff ?? sp.staff) !== "any") q.set("staff", p.staff ?? sp.staff);
    if (p.date) q.set("date", p.date);
    if (p.time) q.set("time", p.time);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  const { service } = ctx;
  const depositBlocked = service.deposit_pence > 0 && !business.stripe_charges_enabled;
  const dates = depositBlocked ? [] : findAvailableDates(ctx.base, today, windowDays);
  const date = sp.date && dates.includes(sp.date) ? sp.date : dates[0];
  const slots = date ? computeSlots({ ...ctx.base, date }) : [];
  const chosen = sp.time ? slots.find((s) => s.start.toISOString() === new Date(sp.time!).toISOString()) : undefined;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PublicHeader name={business.name} logo={logoUrl(business.logo_path)} />
      <main className="space-y-8">
        <div>
          <p><Link href={`/b/${business.slug}`} className="text-sm underline">← All services</Link></p>
          <h1 className="mt-3 text-xl font-semibold">{service.name}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {service.duration_minutes} min · {formatPence(service.price_pence)}
            {service.deposit_pence > 0 && ` · ${formatPence(service.deposit_pence)} deposit to book`}
          </p>
        </div>

        {depositBlocked ? (
          <p role="status">This service needs a deposit, which can&apos;t be taken online yet. Please contact {business.name} to book.</p>
        ) : !dates.length ? (
          <p role="status">There are no free times in the next {windowDays - 1} days. Please check back soon or contact {business.name}.</p>
        ) : (
          <>
            {ctx.staffOptions.length > 1 && (
              <section aria-labelledby="who-h">
                <h2 id="who-h" className="mb-2 font-medium">Who with?</h2>
                <ul className="flex flex-wrap gap-2">
                  {[{ id: "any", name: "Anyone" }, ...ctx.staffOptions].map((s) => (
                    <li key={s.id}>
                      <Link href={href({ staff: s.id, date })} aria-current={sp.staff === s.id ? "true" : undefined}
                        className={`${pill} ${sp.staff === s.id ? active : idle}`}>{s.name}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="date-h">
              <h2 id="date-h" className="mb-2 font-medium">Pick a day</h2>
              <ul className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <li key={d} className="shrink-0">
                    <Link href={href({ date: d })} aria-current={d === date ? "date" : undefined}
                      className={`${pill} ${d === date ? active : idle}`}>{formatYmd(d, tz)}</Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="time-h">
              <h2 id="time-h" className="mb-2 font-medium">Pick a time{date && ` on ${formatYmd(date, tz)}`}</h2>
              <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">Times are UK time.</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => {
                  const iso = s.start.toISOString();
                  const on = chosen?.start.toISOString() === iso;
                  return (
                    <li key={iso}>
                      <Link href={href({ date, time: iso })} aria-current={on ? "true" : undefined}
                        className={`${pill} w-full ${on ? active : idle}`}>{formatTime(s.start, tz)}</Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {chosen && (
              <section aria-labelledby="details-h" className="space-y-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
                <h2 id="details-h" className="font-medium">Your details</h2>
                <p className="text-sm">{service.name}, {formatYmd(date!, tz)} at {formatTime(chosen.start, tz)}</p>
                <BookingForm slug={business.slug} serviceId={service.id} staff={sp.staff} startsAt={chosen.start.toISOString()}
                  privacyUrl={business.privacy_notice_url}
                  depositLabel={service.deposit_pence > 0 ? `Continue to pay ${formatPence(service.deposit_pence)} deposit` : null} />
              </section>
            )}
          </>
        )}
      </main>
      <PublicFooter privacyUrl={business.privacy_notice_url} />
    </div>
  );
}
