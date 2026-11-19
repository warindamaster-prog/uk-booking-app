"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { parsePounds } from "@/lib/money";
import { serviceSchema, uuid } from "@/lib/validation/catalog";

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();

  const raw: Record<string, string> = {};
  for (const k of ["name", "description", "duration", "bufferBefore", "bufferAfter", "price", "deposit"]) {
    raw[k] = String(formData.get(k) ?? "");
  }
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? uuid.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "That service could not be found." };

  const parsed = serviceSchema.safeParse({ ...raw, active: formData.get("active") === "on" });
  if (!parsed.success) return zodState(parsed.error, { ...raw, active: formData.get("active") === "on" ? "on" : "" });

  const v = parsed.data;
  const row = {
    name: v.name, description: v.description, duration_minutes: v.duration,
    buffer_before_minutes: v.bufferBefore, buffer_after_minutes: v.bufferAfter,
    price_pence: v.price, deposit_pence: v.deposit, active: v.active,
  };

  const { error } = id?.success
    ? await supabase.from("services").update(row).eq("id", id.data).eq("business_id", business.id)
    : await supabase.from("services").insert({ ...row, business_id: business.id });
  if (error) {
    const levelClash = error.message?.includes("deposit_above_level_price");
    return {
      error: levelClash ? "The deposit is higher than one of this service's level prices. Raise those prices first, or lower the deposit."
        : "We couldn't save that service. Please try again.",
      values: { ...raw, active: v.active ? "on" : "" },
    };
  }

  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

/** Prices per team level for one service. A blank box means "use the standard price". */
export async function saveLevelPrices(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const serviceId = uuid.safeParse(String(formData.get("serviceId") ?? ""));
  if (!serviceId.success) return { error: "That service could not be found." };

  const { data: levels } = await supabase.from("staff_levels").select("id").eq("business_id", business.id);
  const fieldErrors: Record<string, string[]> = {};
  const rows: { level_id: string; price_pence: number }[] = [];
  const values: Record<string, string> = {};

  for (const l of levels ?? []) {
    const text = String(formData.get(`price-${l.id}`) ?? "").trim();
    values[`price-${l.id}`] = text;
    if (text === "") continue;
    const pence = parsePounds(text);
    if (pence === null) fieldErrors[l.id] = ["Enter an amount like 25 or 25.50"];
    else rows.push({ level_id: l.id, price_pence: pence });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error } = await supabase.rpc("set_service_level_prices", { p_service_id: serviceId.data, p_prices: rows });
  if (error) {
    const low = error.message?.includes("level_price_below_deposit");
    return { error: low ? "A level price can't be lower than this service's deposit." : "Something went wrong. Please try again.", values };
  }
  revalidatePath(`/dashboard/services/${serviceId.data}`);
  return { message: "Level prices saved.", values };
}
