"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import type { FormState } from "@/lib/form";
import { uuid } from "@/lib/validation/catalog";

const GENERIC = "Something went wrong. Please try again.";

export async function anonymiseCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { error: GENERIC };

  const { error } = await supabase.rpc("anonymise_customer", { p_customer_id: id.data });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("customer_has_upcoming_bookings")) {
      return { error: "This customer still has upcoming bookings. Cancel them first, then delete their details." };
    }
    return { error: m.includes("not found") ? "We couldn't find that customer." : GENERIC };
  }
  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers?deleted=1");
}

export async function withdrawConsent(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { error: GENERIC };
  const { error } = await supabase.rpc("withdraw_marketing_consent", { p_customer_id: id.data });
  if (error) return { error: GENERIC };
  revalidatePath(`/dashboard/customers/${id.data}`);
  return { message: "Marketing consent withdrawn." };
}
