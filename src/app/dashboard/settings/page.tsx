import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { getT } from "@/lib/i18n/server";
import { isThemeName, shopColorsEnabled } from "@/lib/theme";
import { ColorForm } from "./color-form";
import Link from "next/link";
import { shopPageEnabled } from "@/lib/shop-page-switch";
import { listShopPhotos } from "@/lib/booking/data";
import { MAX_PHOTOS } from "@/lib/validation/shop-page";
import { ShopPageForm } from "./shop-page/shop-page-form";
import { PhotoManager } from "./shop-page/photo-manager";
import { shopUrl } from "@/lib/shop-host";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const tabsOn = shopPageEnabled();
  const tab = tabsOn && (await searchParams).tab === "booking" ? "booking" : "info";
  const tabs = [{ id: "info", label: "Info & Policy", href: "/dashboard/settings" }, { id: "booking", label: "Booking page", href: "/dashboard/settings?tab=booking" }];
  const tabBar = tabsOn && (
    <nav aria-label={t("Settings")} className="flex gap-2 border-b border-neutral-300 dark:border-neutral-700">
      {tabs.map((x) => (
        <Link key={x.id} href={x.href} aria-current={tab === x.id ? "page" : undefined}
          className={`-mb-px inline-flex min-h-12 items-center border-b-2 px-4 text-sm font-medium ${tab === x.id ? "border-[color:var(--brand,#34553e)] text-[color:var(--brand,#34553e)]" : "border-transparent text-neutral-600 hover:text-inherit dark:text-neutral-400"}`}>
          <span className="mr-2 rounded bg-neutral-200 px-1.5 text-xs font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100">{x.id === "info" ? "A" : "B"}</span>{t(x.label)}
        </Link>
      ))}
    </nav>
  );

  if (tab === "booking") {
    const { data: b } = await supabase.from("businesses").select("about, address, additional_info, shop_page_show").eq("id", business.id).single();
    const photos = await listShopPhotos(business.id);
    const url = shopUrl({ siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL, slug: business.slug });
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        {tabBar}
        <p className="text-sm">{t("This is the first page customers see at {url}. The Book now button leads to your service list.", { url })}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{t("View your page")}</a>
        <section aria-labelledby="photos-h" className="space-y-3">
          <h2 id="photos-h" className="text-xl font-semibold">{t("Photos")}</h2>
          <PhotoManager photos={photos} max={MAX_PHOTOS} />
        </section>
        <section aria-labelledby="text-h" className="space-y-3">
          <h2 id="text-h" className="text-xl font-semibold">{t("What to show")}</h2>
          <ShopPageForm defaults={{ about: b?.about ?? "", address: b?.address ?? "", additionalInfo: b?.additional_info ?? "", show: (b?.shop_page_show as string[] | null) ?? [] }} />
        </section>
      </main>
    );
  }

  const { data: b } = await supabase.from("businesses")
    .select("owner_name, email, phone, cancellation_window_hours, privacy_notice_url, show_contact_to_customers, confirmation_message, deposit_policy, deposit_refundable").eq("id", business.id).single();
  const accent = (business as { accent_color?: string | null }).accent_color;
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
      {tabBar}
      {shopColorsEnabled() && (
        <section aria-labelledby="colour-h" className="space-y-3">
          <h2 id="colour-h" className="text-xl font-semibold">{t("Colour")}</h2>
          <ColorForm current={isThemeName(accent) ? accent : "green"} />
        </section>
      )}
      <SettingsForm shopName={business.name} defaults={{
        ownerName: b?.owner_name ?? "", email: b?.email ?? "", phone: b?.phone ?? "",
        cancellationHours: b?.cancellation_window_hours ?? 24, privacyUrl: b?.privacy_notice_url ?? "", showContact: b?.show_contact_to_customers ?? true,
        confirmationMessage: b?.confirmation_message ?? "",
        depositPolicy: b?.deposit_policy ?? "", depositRefundable: b?.deposit_refundable !== false,
      }} />
    </main>
  );
}
