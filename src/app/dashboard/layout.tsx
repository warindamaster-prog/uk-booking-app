import { themeStyle } from "@/lib/theme";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { billingEnabled, bookingsOpen, daysLeftLabel, trialDaysLeft } from "@/lib/billing";
import { LanguageSwitch } from "@/components/language-switch";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";

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

  const items: NavItem[] = [
    { href: "/dashboard", label: t("Overview"), icon: "grid" },
    { href: "/dashboard/calendar", label: t("Schedule"), icon: "calendar" },
    { href: "/dashboard/bookings", label: t("Bookings"), icon: "book" },
    ...(role === "owner" ? [
      { href: "/dashboard/services", label: t("Services"), icon: "spark" },
      { href: "/dashboard/customers", label: t("Customers"), icon: "users" },
      { href: "/dashboard/staff", label: t("Staff"), icon: "staff" },
      { href: "/dashboard/payments", label: t("Payments"), icon: "wallet" },
      { href: "/dashboard/billing", label: t("Billing"), icon: "card" },
      { href: "/dashboard/settings", label: t("Settings"), icon: "settings" },
    ] as NavItem[] : myStaffId ? [{ href: `/dashboard/staff/${myStaffId}`, label: t("My hours"), icon: "staff" }] as NavItem[] : []),
    { href: "/dashboard/support", label: t("Support"), icon: "help" },
  ];
  const initial = business.name.trim().charAt(0).toUpperCase();

  return (
    <div className="public-light min-h-screen overflow-x-hidden bg-[color:var(--brand-bg,#f7f8f3)] text-[color:var(--brand-ink,#293a2c)] selection:bg-[color:var(--brand-soft,#e0eabe)]" style={themeStyle((business as { accent_color?: string | null }).accent_color)}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[224px] flex-col border-r border-[color:var(--brand-line,#e2e7da)] bg-[#fcfdf9] lg:flex">
        <Link href="/dashboard" className="flex h-[84px] items-center gap-3 px-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--brand,#355c3e)] font-semibold text-[color:var(--brand-on,#e6efca)]">{initial}</span>
          )}
          <span className="truncate text-lg font-bold tracking-tight">{business.name}</span>
        </Link>
        <DashboardNav items={items} label={t("Dashboard")} variant="side" />
        <div className="flex items-center gap-3 border-t border-[color:var(--brand-line,#e5e9dd)] p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.email}</p>
            <p className="text-xs text-[color:var(--brand-muted,#6a765f)]">{role === "owner" ? t("Workspace owner") : t("Team member")}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="min-h-11 rounded-lg px-2 text-sm text-[color:var(--brand-text,#486339)] underline">{t("Log out")}</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 lg:ml-[224px]">
        <header className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--brand-line,#e4e8dc)] bg-[#fcfdf9] px-5 py-2 md:px-8">
          <Link href="/dashboard" className="text-sm font-semibold lg:hidden">{business.name}</Link>
          <span className="hidden text-sm text-[color:var(--brand-muted,#6a775f)] lg:block">{business.name}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <form action="/auth/signout" method="post" className="lg:hidden">
              <button type="submit" className="min-h-11 text-sm underline">{t("Log out")}</button>
            </form>
          </div>
        </header>
        <DashboardNav items={items} label={t("Dashboard")} variant="top" />
        <div className="mx-auto w-full max-w-[1100px] px-5 py-7 md:px-8">
      {billing && billingEnabled() && !bookingsOpen(billing, { now: new Date(), billingEnabled: true }) && (
        <p role="alert" className="mb-6 rounded-xl border border-[#e8dcb5] bg-[#fcf7e9] p-4 text-sm leading-6 text-[#735c2d]">
          {rich(t, "Your booking page is closed: customers can't book until you subscribe. {billing} or {contact}. You can still use everything here, including your bookings.", {
            billing: <Link href="/dashboard/billing" className="underline">{t("Open Billing")}</Link>,
            contact: <Link href="/dashboard/support" className="underline">{t("contact us")}</Link>,
          })}
        </p>
      )}
      {billing?.status === "trialing" && bookingsOpen(billing, { now: new Date(), billingEnabled: billingEnabled() }) && (
        <p role="status" className="mb-6 rounded-xl border border-[color:var(--brand-border,#dce5ca)] bg-[color:var(--brand-soft,#edf2e1)] p-4 text-sm leading-6 text-[color:var(--brand-text,#4a6736)]">
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
      </div>
    </div>
  );
}
