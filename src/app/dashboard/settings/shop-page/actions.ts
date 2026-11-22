"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { shopPageEnabled } from "@/lib/shop-page-switch";
import { LOGO_TYPES, sniffLogoType } from "@/lib/validation/business";
import { MAX_PHOTOS, PHOTO_MAX_BYTES, SECTION_KEYS, shopPageSchema } from "@/lib/validation/shop-page";

export async function saveShopPage(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  if (!shopPageEnabled()) return { error: "Your shop page isn't available yet." };
  const raw = Object.fromEntries(["about", "address", "additionalInfo"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = shopPageSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, raw);
  const show = [...new Set(formData.getAll("show").map(String))].filter((k) => SECTION_KEYS.includes(k));
  const { error } = await supabase.from("businesses").update({
    about: parsed.data.about, address: parsed.data.address, additional_info: parsed.data.additionalInfo, shop_page_show: show,
  }).eq("id", business.id);
  if (error) return { error: "Something went wrong. Please try again.", values: raw };
  revalidatePath("/dashboard/settings");
  return { message: "Saved.", values: raw };
}

/** One photo per call (the browser sends them one at a time, shrunk first). */
export async function uploadPhoto(formData: FormData): Promise<{ error?: string }> {
  const { supabase, business } = await requireOwner();
  if (!shopPageEnabled()) return { error: "Your shop page isn't available yet." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > PHOTO_MAX_BYTES) return { error: "Each photo must be 4 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffLogoType(bytes);
  if (!type) return { error: "Use a PNG, JPEG or WebP image." };

  const { data: existing } = await supabase.from("shop_photos").select("sort_order").eq("business_id", business.id).order("sort_order", { ascending: false });
  if ((existing?.length ?? 0) >= MAX_PHOTOS) return { error: "You can have up to 12 photos. Delete one to add another." };
  const next = (existing?.[0]?.sort_order ?? -1) + 1;

  const path = `${business.id}/photo-${crypto.randomUUID()}.${LOGO_TYPES[type]}`;
  const up = await supabase.storage.from("shop-photos").upload(path, bytes, { contentType: type, cacheControl: "31536000" });
  if (up.error) return { error: "Could not upload the photo. Please try again." };
  const ins = await supabase.from("shop_photos").insert({ business_id: business.id, path, sort_order: next });
  if (ins.error) {
    await supabase.storage.from("shop-photos").remove([path]);
    return { error: "Could not save the photo. Please try again." };
  }
  revalidatePath("/dashboard/settings");
  return {};
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const { supabase, business } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const { data } = await supabase.from("shop_photos").select("path").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!data) return;
  await supabase.from("shop_photos").delete().eq("id", id).eq("business_id", business.id);
  await supabase.storage.from("shop-photos").remove([data.path as string]);
  revalidatePath("/dashboard/settings");
}

/** Makes a photo the cover (first in the list). */
export async function makeCover(formData: FormData): Promise<void> {
  const { supabase, business } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const { data: first } = await supabase.from("shop_photos").select("sort_order").eq("business_id", business.id).order("sort_order").limit(1).maybeSingle();
  await supabase.from("shop_photos").update({ sort_order: (first?.sort_order ?? 0) - 1 }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/dashboard/settings");
}
