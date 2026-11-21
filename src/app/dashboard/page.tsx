import type { Metadata } from "next";
import Link from "next/link";
import { BookingCard } from "@/components/booking-card";
import { MonthSchedule } from "@/components/month-schedule";
import { requireBusiness } from "@/lib/auth";
import { rangeFor } from "@/lib/calendar";
import { fetchBookings, LIVE_STATUSES } from "@/lib/dashboard/bookings";
import { todayYmd } from "@/lib/time";
import { publicEnv } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ logo?: string; month?: string; staff?: string }> }) {
  const ctx = await requireBusiness();
  const t = await getT();
  const { supabase, business, role } = ctx;
  const { from, to } = rangeFor("day", todayYmd(business.timezone), business.timezone);
  const { rows: today } = await fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, statuses: LIVE_STATUSES });
  const { logo, month, staff } = await searchParams;
  const { count: serviceCount } = await supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const weekRange = rangeFor("week", todayYmd(business.timezone), business.timezone);
  const { count: weekCount } = await supabase.from("bookings").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).in("status", [...LIVE_STATUSES]).gte("starts_at", weekRange.from.toISOString()).lt("starts_at", weekRange.to.toISOString());
  const { count: customerCount } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const publicUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/b/${business.slug}`;

  return (
    <main className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("Bookings today"), value: today.length },
          { label: t("This week"), value: weekCount ?? 0 },
          { label: t("Customers"), value: customerCount ?? 0 },
        ].map((x) => (
          <article key={x.label} className="rounded-xl border border-[#e2e7da] bg-white px-5 py-5">
            <p className="text-sm text-[#68755e]">{x.label}</p>
            <p className="mt-1 text-[34px] font-semibold tracking-[-1px]">{x.value}</p>
          </article>
        ))}
      </div>
      {logo === "failed" && (
        <p role="status" className="rounded-md border border-amber-700 p-3 text-sm">
          {t("Your business was created, but the logo couldn't be uploaded. You can add it later.")}
        </p>
      )}
      <section aria-labelledby="today-h" className="space-y-3 rounded-2xl border border-[#e0e6d7] bg-white p-5">
        <h2 id="today-h" className="text-lg font-semibold tracking-tight">{t("Today")}</h2>
        {today.length ? (
          <ul className="space-y-2">{today.map((b) => <li key={b.id}><BookingCard b={b} tz={business.timezone} showStaff={role === "owner"} compact /></li>)}</ul>
        ) : <p>{t("No bookings today.")}</p>}
        <p><Link href="/dashboard/calendar" className="text-sm underline">{t("Open the schedule")}</Link></p>
      </section>
      <MonthSchedule ctx={ctx} params={{ month, staff }} />
      <section className="rounded-2xl border border-[#dce5ca] bg-[#edf2e1] p-5">
        <h2 className="text-sm font-semibold">{t("Your booking link")}</h2>
        <p className="mt-2 break-all text-sm"><a className="text-[#4a6736] underline" href={publicUrl}>{publicUrl}</a></p>
      </section>
      {role === "owner" && !serviceCount && (
        <p>
          {rich(t, "Next: add your {services}, then set up your {staff} and their working hours.", {
            services: <Link className="underline" href="/dashboard/services">{t("services")}</Link>,
            staff: <Link className="underline" href="/dashboard/staff">{t("staff")}</Link>,
          })}
        </p>
      )}
    </main>
  );
}
