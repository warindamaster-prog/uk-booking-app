"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import type { FormState } from "@/lib/form";
import { levelNameSchema, uuid } from "@/lib/validation/catalog";

const DUPLICATE = "You already have a level with that name.";
const GENERIC = "Something went wrong. Please try again.";

function revalidate() {
  revalidatePath("/dashboard/staff/levels");
  revalidatePath("/dashboard/staff");
}

export async function addLevel(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const name = String(formData.get("name") ?? "");
  const parsed = levelNameSchema.safeParse(name);
  if (!parsed.success) return { fieldErrors: { name: [parsed.error.issues[0].message] }, values: { name } };

  const { count } = await supabase.from("staff_levels").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const { error } = await supabase.from("staff_levels").insert({ business_id: business.id, name: parsed.data, sort_order: count ?? 0 });
  if (error) return error.code === "23505" ? { fieldErrors: { name: [DUPLICATE] }, values: { name } } : { error: GENERIC, values: { name } };
  revalidate();
  return { message: "Level added." };
}

export async function renameLevel(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  const name = String(formData.get("name") ?? "");
  const parsed = levelNameSchema.safeParse(name);
  if (!id.success) return { error: GENERIC };
  if (!parsed.success) return { fieldErrors: { name: [parsed.error.issues[0].message] }, values: { name } };

  const { error } = await supabase.from("staff_levels").update({ name: parsed.data }).eq("id", id.data).eq("business_id", business.id);
  if (error) return error.code === "23505" ? { fieldErrors: { name: [DUPLICATE] }, values: { name } } : { error: GENERIC, values: { name } };
  revalidate();
  return { message: "Saved.", values: { name: parsed.data } };
}

export async function deleteLevel(formData: FormData): Promise<void> {
  const { supabase, business } = await requireOwner();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return;
  await supabase.from("staff_levels").delete().eq("id", id.data).eq("business_id", business.id);
  revalidatePath("/dashboard/services");
  revalidate();
}
