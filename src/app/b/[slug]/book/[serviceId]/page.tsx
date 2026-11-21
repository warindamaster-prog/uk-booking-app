import { depositPolicyText } from "@/lib/deposit-policy";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { computeSlots, findAvailableDates } from "@/lib/availability";
import { buildChoices, type Choice } from "@/lib/booking/choices";
import { acceptsBookings, getBusinessBySlug, loadBookingContext, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { formatTime, formatYmd, todayYmd } from "@/lib/time";
import { bookPageParams } from "@/lib/validation/booking";
import { uuid } from "@/lib/validation/catalog";
import { PublicShell } from "../../chrome";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Choose a time" };

type Props = {
  params: Promise<{ slug: string; serviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pill = "inline-flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451]";
const idle = "border-stone-200 bg-white text-stone-700 hover:bg-stone-50";
const active = "border-[#496746] bg-[#eef3e9] text-[#34553e]";

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
  const choices = buildChoices(ctx.staffOptions);
  // Prices differ by level: a person or level must be chosen so the price is known. Default to the cheapest.
  if (ctx.price_pence === null) redirect(href({ staff: choices.defaultValue }));
  const price = ctx.price_pence;
  const label = (c: Choice) => (choices.grouped ? `${c.label} · ${formatPence(c.price_pence)}` : c.label);
  const showChoices = choices.grouped || choices.people.length > 1;
  const depositBlocked = service.deposit_pence > 0 && !business.stripe_charges_enabled;
  const dates = depositBlocked ? [] : findAvailableDates(ctx.base, today, windowDays);
  const date = sp.date && dates.includes(sp.date) ? sp.date : dates[0];
  const slots = date ? computeSlots({ ...ctx.base, date }) : [];
  const chosen = sp.time ? slots.find((s) => s.start.toISOString() === new Date(sp.time!).toISOString()) : undefined;

  const withName = choices.people.length === 1 ? choices.people[0].label : choices.people.find((c) => c.value === sp.staff)?.label;
  const summary = {
    serviceName: service.name, minutes: service.duration_minutes, pricePence: price, depositPence: service.deposit_pence,
    with: withName,
    when: chosen && date ? `${formatYmd(date, tz)} at ${formatTime(chosen.start, tz)}` : undefined,
  };

  return (
    <PublicShell slug={business.slug} name={business.name} logo={logoUrl(business.logo_path)} privacyUrl={business.privacy_notice_url} step={chosen ? 3 : 2} summary={summary}>
      <div className="space-y-8">
        <div>
          <p>
            <Link href={`/b/${business.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dfe5da] bg-white px-4 text-sm font-medium text-[#415044] transition hover:bg-[#f1f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451]">
              <svg className="h-4 w-4 shrink-0 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
              All services
            </Link>
          </p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-1px]">{service.name}</h1>
          <p className="mt-1 text-sm text-[#6b756d]">
            {service.duration_minutes} min · {formatPence(price)}
          </p>
          {service.deposit_pence > 0 && (
            <p className="mt-3 rounded-xl border border-[#e0e5df] bg-white p-4 text-sm">
              Deposit to pay now by card: <strong>{formatPence(service.deposit_pence)}</strong>
              {price > service.deposit_pence && <> · Rest to pay at the appointment: {formatPence(price - service.deposit_pence)}</>}
              <span className="mt-1 block whitespace-pre-wrap text-[#4f5d52]">
                {depositPolicyText({ policy: business.deposit_policy, refundable: business.deposit_refundable, windowHours: business.cancellation_window_hours, businessName: business.name })}
              </span>
            </p>
          )}
        </div>

        {choices.people.length === 1 && (
          <p className="text-sm">With <span className="font-medium">{choices.people[0].label}</span>{choices.people[0].description && <span className="block opacity-90">{choices.people[0].description}</span>}</p>
        )}

        {depositBlocked ? (
          <p role="status">This service needs a deposit, which can&apos;t be taken online yet. Please contact {business.name} to book.</p>
        ) : (
          <>
            {showChoices && (
              <section aria-labelledby="who-h" className="space-y-3">
                <h2 id="who-h" className="text-lg font-semibold tracking-tight">Who with?</h2>
                {choices.groups.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {choices.groups.map((c) => (
                      <li key={c.value}>
                        <Link href={href({ staff: c.value, date })} aria-current={sp.staff === c.value ? "true" : undefined}
                          className={`${pill} ${sp.staff === c.value ? active : idle}`}>{label(c)}</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {choices.people.length > 1 && (
                  <>
                    {choices.groups.length > 0 && <p className="text-sm text-[#6b756d]">Or choose a person:</p>}
                    <ul className="space-y-2">
                      {choices.people.map((c) => (
                        <li key={c.value}>
                          <Link href={href({ staff: c.value, date })} aria-current={sp.staff === c.value ? "true" : undefined}
                            className={`block rounded-lg border px-3 py-2 text-sm ${sp.staff === c.value ? active : idle}`}>
                            <span className="block font-medium">{label(c)}</span>
                            {c.description && <span className="mt-0.5 block text-sm opacity-90">{c.description}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            {!dates.length ? (
            <p role="status">There are no free times in the next {windowDays - 1} days. Please check back soon or contact {business.name}.</p>
            ) : (
              <>
            <section aria-labelledby="date-h">
              <h2 id="date-h" className="mb-3 text-lg font-semibold tracking-tight">Pick a day</h2>
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
              <h2 id="time-h" className="mb-2 text-lg font-semibold tracking-tight">Pick a time{date && ` on ${formatYmd(date, tz)}`}</h2>
              <p className="mb-2 text-sm text-[#6b756d]">Times are UK time.</p>
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
              <section aria-labelledby="details-h" className="space-y-4 rounded-2xl border border-[#e0e5df] bg-white p-6">
                <h2 id="details-h" className="text-lg font-semibold tracking-tight">Your details</h2>
                <p className="text-sm">{service.name}, {formatYmd(date!, tz)} at {formatTime(chosen.start, tz)} · {formatPence(price)}</p>
                <BookingForm slug={business.slug} serviceId={service.id} staff={sp.staff} startsAt={chosen.start.toISOString()}
                  privacyUrl={business.privacy_notice_url}
                  depositLabel={service.deposit_pence > 0 ? `Continue to pay ${formatPence(service.deposit_pence)} deposit` : null} />
              </section>
            )}
              </>
            )}
          </>
        )}
      </div>
    </PublicShell>
  );
}
