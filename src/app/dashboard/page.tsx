import { shopUrl } from "@/lib/shop-host";
import type { Metadata } from "next";
import Link from "next/link";
import { MonthSchedule } from "@/components/month-schedule";
import { requireBusiness } from "@/lib/auth";
import { rangeFor } from "@/lib/calendar";
import { monthBounds, monthLabel, parseMonth } from "@/lib/schedule";
import { intlLocale } from "@/lib/i18n/core";
import { fetchBookings, LIVE_STATUSES } from "@/lib/dashboard/bookings";
import { todayYmd } from "@/lib/time";
import { publicEnv } from "@/lib/env";
import { getLocale, getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ logo?: string; month?: string; staff?: string; day?: string }> }) {
  const ctx = await requireBusiness();
  const t = await getT();
  const loc = intlLocale(await getLocale());
  const { supabase, business, role } = ctx;
  const { from, to } = rangeFor("day", todayYmd(business.timezone), business.timezone);
  const { rows: today } = await fetchBookings(supabase, business.id, { startsFrom: from, startsBefore: to, statuses: LIVE_STATUSES });
  const { logo, month, staff, day } = await searchParams;
  const { count: serviceCount } = await supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const shownMonth = parseMonth(month, todayYmd(business.timezone));
  const mb = monthBounds(shownMonth, business.timezone);
  const { count: monthCount } = await supabase.from("bookings").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).in("status", [...LIVE_STATUSES]).gte("starts_at", mb.from.toISOString()).lt("starts_at", mb.to.toISOString());
  const { count: customerCount } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const publicUrl = shopUrl({ siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL, slug: business.slug });

  return (
    <main className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[1.4px] text-[color:var(--brand-muted,#7a876a)]">{t("Your business, at a glance")}</p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-1.1px]">{t("A clearer view of your day.")}</h1>
        <p className="mt-2 text-sm text-[color:var(--brand-muted,#6b7762)]">{t("A little less admin. More time for what you do best.")}</p>
      </div>
      {logo === "failed" && (
        <p role="status" className="rounded-xl border border-[#e8dcb5] bg-[#fcf7e9] p-4 text-sm text-[#735c2d]">
          {t("Your business was created, but the logo couldn't be uploaded. You can add it later.")}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("Bookings today"), value: today.length, sub: today.length ? t("Your day at a glance") : t("A little breathing room") },
          { label: t("Bookings this month"), value: monthCount ?? 0, sub: monthLabel(shownMonth, business.timezone, loc) },
          { label: t("Active customers"), value: customerCount ?? 0, sub: t("People behind the bookings") },
        ].map((x) => (
          <article key={x.label} className="rounded-xl border border-[color:var(--brand-line,#e2e7da)] bg-white px-5 py-5">
            <p className="text-sm text-[color:var(--brand-muted,#68755e)]">{x.label}</p>
            <p className="mt-1 text-[34px] font-semibold tracking-[-1px]">{x.value}</p>
            <p className="mt-1 text-xs text-[color:var(--brand-muted,#728066)]">{x.sub}</p>
          </article>
        ))}
      </div>
      <MonthSchedule ctx={ctx} params={{ month, staff, day }} publicUrl={publicUrl} />
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
