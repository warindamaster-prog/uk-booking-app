import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { billingEnabled, bookingsOpen, daysLeftLabel, trialDaysLeft } from "@/lib/billing";
import { LanguageSwitch } from "@/components/language-switch";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, business, role, user } = await requireBusiness();
  const t = await getT();
  const logoUrl = business.logo_path
    ? supabase.storage.from("logos").getPublicUrl(business.logo_path).data.publicUrl
    : null;

  const { data: billing } = role === "owner"
    ? await supabase.from("business_billing").select("status, trial_ends_at").eq("business_id", business.id).maybeSingle()
    : { data: null };

  let myStaffId: string | null = null;
  if (role === "staff") {
    const { data } = await supabase.from("staff").select("id").eq("business_id", business.id).eq("user_id", user.id).maybeSingle();
    myStaffId = data?.id ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />}
          <span className="text-xl font-semibold">{business.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm underline">{t("Log out")}</button>
          </form>
        </div>
      </header>
      <nav aria-label={t("Dashboard")} className="mb-8 flex flex-wrap gap-x-4 gap-y-2 border-b border-neutral-300 pb-3 text-sm dark:border-neutral-700">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">{t("Overview")}</Link>
        <Link href="/dashboard/calendar" className="underline-offset-4 hover:underline">{t("Schedule")}</Link>
        <Link href="/dashboard/bookings" className="underline-offset-4 hover:underline">{t("Bookings")}</Link>
        {role === "owner" ? (
          <>
            <Link href="/dashboard/services" className="underline-offset-4 hover:underline">{t("Services")}</Link>
            <Link href="/dashboard/customers" className="underline-offset-4 hover:underline">{t("Customers")}</Link>
            <Link href="/dashboard/staff" className="underline-offset-4 hover:underline">{t("Staff")}</Link>
            <Link href="/dashboard/payments" className="underline-offset-4 hover:underline">{t("Payments")}</Link>
            <Link href="/dashboard/billing" className="underline-offset-4 hover:underline">{t("Billing")}</Link>
            <Link href="/dashboard/settings" className="underline-offset-4 hover:underline">{t("Settings")}</Link>
          </>
        ) : myStaffId ? (
          <Link href={`/dashboard/staff/${myStaffId}`} className="underline-offset-4 hover:underline">{t("My hours")}</Link>
        ) : null}
        <Link href="/dashboard/support" className="underline-offset-4 hover:underline">{t("Support")}</Link>
      </nav>
      {billing && billingEnabled() && !bookingsOpen(billing, { now: new Date(), billingEnabled: true }) && (
        <p role="alert" className="mb-6 rounded-md border border-amber-700 p-3 text-sm">
          {rich(t, "Your booking page is closed: customers can't book until you subscribe. {billing} or {contact}. You can still use everything here, including your bookings.", {
            billing: <Link href="/dashboard/billing" className="underline">{t("Open Billing")}</Link>,
            contact: <Link href="/dashboard/support" className="underline">{t("contact us")}</Link>,
          })}
        </p>
      )}
      {billing?.status === "trialing" && bookingsOpen(billing, { now: new Date(), billingEnabled: billingEnabled() }) && (
        <p role="status" className="mb-6 rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          {billingEnabled()
            ? rich(t, "Free trial: {left}. {addCard} to keep your booking page open afterwards.", {
              left: daysLeftLabel(trialDaysLeft(billing.trial_ends_at), t),
              addCard: <Link href="/dashboard/billing" className="underline">{t("Add a card")}</Link>,
            })
            : t("Free trial: {left}. No card needed.", { left: daysLeftLabel(trialDaysLeft(billing.trial_ends_at), t) })}
        </p>
      )}
      {children}
    </div>
  );
}
