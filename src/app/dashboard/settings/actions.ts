"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { settingsSchema } from "@/lib/validation/settings";

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const raw = Object.fromEntries(["ownerName", "email", "phone", "cancellationHours", "privacyUrl", "confirmationMessage"].map((k) => [k, String(formData.get(k) ?? "")]));
  const showContact = formData.get("showContact") === "on";
  const parsed = settingsSchema.safeParse({ ...raw, showContact });
  if (!parsed.success) return zodState(parsed.error, { ...raw, showContact: showContact ? "on" : "" });

  const { error } = await supabase.from("businesses").update({
    owner_name: parsed.data.ownerName, email: parsed.data.email, phone: parsed.data.phone,
    cancellation_window_hours: parsed.data.cancellationHours, privacy_notice_url: parsed.data.privacyUrl, confirmation_message: parsed.data.confirmationMessage,
    show_contact_to_customers: parsed.data.showContact,
  }).eq("id", business.id);
  if (error) return { error: "Something went wrong. Please try again.", values: { ...raw, showContact: showContact ? "on" : "" } };
  revalidatePath("/dashboard/settings");
  return { message: "Settings saved.", values: { ...raw, showContact: showContact ? "on" : "" } };
}
