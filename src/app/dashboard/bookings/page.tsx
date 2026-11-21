import type { Metadata } from "next";
import Link from "next/link";
import { BookingCard } from "@/components/booking-card";
import { requireBusiness } from "@/lib/auth";
import { fetchBookings } from "@/lib/dashboard/bookings";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 25;
const FILTERS = {
  upcoming: { label: "Upcoming", statuses: ["confirmed", "pending_payment"] },
  past: { label: "Past", statuses: ["confirmed", "no_show", "completed"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled", "expired"] },
} as const;
type Filter = keyof typeof FILTERS;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, business, role } = await requireBusiness();
  const t = await getT();
  const raw = await searchParams;
  const val = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const filter: Filter = val("filter") === "past" || val("filter") === "cancelled" ? (val("filter") as Filter) : "upcoming";
  const page = Math.max(1, Number.parseInt(val("page") ?? "1", 10) || 1);
  const now = new Date();

  const { rows, total } = await fetchBookings(supabase, business.id, {
    statuses: FILTERS[filter].statuses,
    ...(filter === "upcoming" ? { startsFrom: now } : {}),
    ...(filter === "past" ? { startsBefore: now } : {}),
    ascending: filter === "upcoming",
    limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (f: Filter, pg = 1) => `/dashboard/bookings?filter=${f}${pg > 1 ? `&page=${pg}` : ""}`;
  const pill = "inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm";
  const on = "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900";

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Bookings")}</h1>
      <ul className="flex flex-wrap gap-2" aria-label={t("Show")}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <li key={f}><Link href={href(f)} aria-current={filter === f ? "true" : undefined} className={`${pill} ${filter === f ? on : ""}`}>{t(FILTERS[f].label)}</Link></li>
        ))}
      </ul>

      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((b) => <li key={b.id}><BookingCard b={b} tz={business.timezone} showDate showStaff={role === "owner"} /></li>)}
        </ul>
      ) : <p>{t(filter === "upcoming" ? "No upcoming bookings." : filter === "past" ? "No past bookings." : "No cancelled bookings.")}</p>}

      {pages > 1 && (
        <nav aria-label={t("Pages")} className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(filter, page - 1)} className="underline">{t("← Newer")}</Link> : <span />}
          <span>{t("Page {page} of {pages}", { page, pages })}</span>
          {page < pages ? <Link href={href(filter, page + 1)} className="underline">{t("Older →")}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
