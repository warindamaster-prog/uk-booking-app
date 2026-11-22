import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { getT } from "@/lib/i18n/server";
import { isThemeName, shopColorsEnabled } from "@/lib/theme";
import { ColorForm } from "./color-form";
import Link from "next/link";
import { shopHoursEnabled, shopPageEnabled } from "@/lib/shop-page-switch";
import { listShopPhotos } from "@/lib/booking/data";
import { defaultHoursFields } from "@/lib/hours";
import { minutesToHhmm } from "@/lib/time";
import { MAX_PHOTOS } from "@/lib/validation/shop-page";
import { ShopPageForm } from "./shop-page/shop-page-form";
import { LogoManager } from "./shop-page/logo-manager";
import { logoUrl } from "@/lib/booking/data";
import { PhotoManager } from "./shop-page/photo-manager";
import { shopUrl } from "@/lib/shop-host";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const bookingOn = shopPageEnabled();
  const themeOn = shopColorsEnabled();
  const tabsOn = bookingOn || themeOn;
  const want = (await searchParams).tab;
  const tab = want === "booking" && bookingOn ? "booking" : want === "theme" && themeOn ? "theme" : "info";
  const tabs = [
    { id: "info", label: "Info & Policy", href: "/dashboard/settings" },
    ...(bookingOn ? [{ id: "booking", label: "Booking page", href: "/dashboard/settings?tab=booking" }] : []),
    ...(themeOn ? [{ id: "theme", label: "Theme", href: "/dashboard/settings?tab=theme" }] : []),
  ];
  const tabBar = tabsOn && (
    <nav aria-label={t("Settings")} className="flex flex-wrap gap-2">
      {tabs.map((x) => (
        <Link key={x.id} href={x.href} aria-current={tab === x.id ? "page" : undefined}
          className={`inline-flex min-h-12 items-center rounded-lg border-2 px-5 text-sm font-semibold ${tab === x.id ? "border-[color:var(--brand,#34553e)] bg-white text-[color:var(--brand,#34553e)]" : "border-transparent text-neutral-600 hover:border-neutral-300 dark:text-neutral-400"}`}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );

  if (tab === "theme") {
    const accent = (business as { accent_color?: string | null }).accent_color;
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        {tabBar}
        <section aria-labelledby="colour-h" className="space-y-3">
          <h2 id="colour-h" className="text-xl font-semibold">{t("Colour")}</h2>
          <ColorForm current={isThemeName(accent) ? accent : "green"} />
        </section>
      </main>
    );
  }

  if (tab === "booking") {
    const hoursOn = shopHoursEnabled();
    const cols: string = `about, address, additional_info, shop_page_show${hoursOn ? ", shop_hours" : ""}`;
    const { data: b } = (await supabase.from("businesses").select(cols).eq("id", business.id).single()) as unknown as {
      data: { about: string | null; address: string | null; additional_info: string | null; shop_page_show: string[] | null; shop_hours?: { weekday: number; start: number; end: number }[] | null } | null;
    };
    const photos = await listShopPhotos(business.id);
    const url = shopUrl({ siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL, slug: business.slug });
    const own = hoursOn && Array.isArray(b?.shop_hours);
    // Typed-in hours fill the form; otherwise suggest 08:00 to 17:00, which only becomes real when the owner saves.
    let hoursInitial: Record<string, string> = defaultHoursFields(minutesToHhmm);
    if (own) {
      hoursInitial = {};
      const seen: Record<number, number> = {};
      for (const h of b!.shop_hours!) {
        const n = (seen[h.weekday] = (seen[h.weekday] ?? -1) + 1);
        hoursInitial[`h-${h.weekday}-${n}-start`] = minutesToHhmm(h.start);
        hoursInitial[`h-${h.weekday}-${n}-end`] = minutesToHhmm(h.end);
      }
    }
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        {tabBar}
        <p className="text-sm">{t("This is the first page customers see at {url}. The Book now button leads to your service list.", { url })}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{t("View your page")}</a>
        <LogoManager url={logoUrl(business.logo_path)} initial={business.name.trim().charAt(0).toUpperCase()} />
        <ShopPageForm defaults={{ about: b?.about ?? "", address: b?.address ?? "", additionalInfo: b?.additional_info ?? "", show: b?.shop_page_show ?? [] }}
          hoursEnabled={hoursOn} hoursOwn={own} hoursInitial={hoursInitial}>
          <PhotoManager photos={photos} max={MAX_PHOTOS} />
        </ShopPageForm>
      </main>
    );
  }

  const { data: b } = await supabase.from("businesses")
    .select("owner_name, email, phone, cancellation_window_hours, privacy_notice_url, show_contact_to_customers, confirmation_message, deposit_policy, deposit_refundable").eq("id", business.id).single();
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
      {tabBar}
      <SettingsForm shopName={business.name} defaults={{
        ownerName: b?.owner_name ?? "", email: b?.email ?? "", phone: b?.phone ?? "",
        cancellationHours: b?.cancellation_window_hours ?? 24, privacyUrl: b?.privacy_notice_url ?? "", showContact: b?.show_contact_to_customers ?? true,
        confirmationMessage: b?.confirmation_message ?? "",
        depositPolicy: b?.deposit_policy ?? "", depositRefundable: b?.deposit_refundable !== false,
      }} />
    </main>
  );
}
