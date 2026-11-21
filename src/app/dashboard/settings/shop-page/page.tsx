import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { shopPageEnabled } from "@/lib/shop-page-switch";
import { shopUrl } from "@/lib/shop-host";
import { publicEnv } from "@/lib/env";
import { listShopPhotos } from "@/lib/booking/data";
import { MAX_PHOTOS } from "@/lib/validation/shop-page";
import { ShopPageForm } from "./shop-page-form";
import { PhotoManager } from "./photo-manager";

export const metadata: Metadata = { title: "Shop page" };

export default async function ShopPageSettings() {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  if (!shopPageEnabled()) {
    return (
      <main className="space-y-6">
        <BackLink href="/dashboard/settings" label={t("← Settings")} />
        <h1 className="text-2xl font-semibold">{t("Shop page")}</h1>
        <p className="text-sm">{t("Your shop page isn't available yet.")}</p>
      </main>
    );
  }
  const { data: b } = await supabase.from("businesses").select("about, address, additional_info").eq("id", business.id).single();
  const photos = await listShopPhotos(business.id);
  const url = shopUrl({ siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL, slug: business.slug });
  return (
    <main className="space-y-8">
      <BackLink href="/dashboard/settings" label={t("← Settings")} />
      <div>
        <h1 className="text-2xl font-semibold">{t("Shop page")}</h1>
        <p className="mt-2 text-sm">{t("This is the first page customers see at {url}: your photos, about, opening times and map. The Book now button leads to your service list.", { url })}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm underline">{t("View your page")}</a>
      </div>
      <section aria-labelledby="photos-h" className="space-y-3">
        <h2 id="photos-h" className="text-xl font-semibold">{t("Photos")}</h2>
        <PhotoManager photos={photos} max={MAX_PHOTOS} />
      </section>
      <section aria-labelledby="text-h" className="space-y-3">
        <h2 id="text-h" className="text-xl font-semibold">{t("About and address")}</h2>
        <ShopPageForm defaults={{ about: b?.about ?? "", address: b?.address ?? "", additionalInfo: b?.additional_info ?? "" }} />
      </section>
    </main>
  );
}
