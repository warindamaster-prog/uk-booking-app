import type { Metadata } from "next";
import Link from "next/link";
import { BookingCard } from "@/components/booking-card";
import { MonthSchedule } from "@/components/month-schedule";
import { requireBusiness } from "@/lib/auth";
import { rangeFor } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES } from "@/lib/dashboard/bookings";
import { todayYmd } from "@/lib/time";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ logo?: string; month?: string; staff?: string }> }) {
  const ctx = await requireBusiness();
  const { supabase, business, role } = ctx;
  const { from, to } = rangeFor("day", todayYmd(business.timezone), business.timezone);
  const { rows: today } = await fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, statuses: LIVE_STATUSES });
  const { logo, month, staff } = await searchParams;
  const publicUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/b/${business.slug}`;

  return (
    <main className="space-y-4">
      {logo === "failed" && (
        <p role="status" className="rounded-md border border-amber-700 p-3 text-sm">
          Your business was created, but the logo couldn&apos;t be uploaded. You can add it later.
        </p>
      )}
      <section aria-labelledby="today-h" className="space-y-2">
        <h2 id="today-h" className="text-xl font-semibold">Today</h2>
        {today.length ? (
          <ul className="space-y-2">{today.map((b) => <li key={b.id}><BookingCard b={b} tz={business.timezone} showStaff={role === "owner"} compact /></li>)}</ul>
        ) : <p>No bookings today.</p>}
        <p><Link href="/dashboard/calendar" className="text-sm underline">Open the schedule</Link></p>
      </section>
      <MonthSchedule ctx={ctx} params={{ month, staff }} />
      <p>Your booking page: <a className="underline" href={publicUrl}>{publicUrl}</a></p>
      {role === "owner" && (
        <p>
          Next: add your <Link className="underline" href="/dashboard/services">services</Link>, then
          set up your <Link className="underline" href="/dashboard/staff">staff</Link> and their working hours.
        </p>
      )}
    </main>
  );
}
