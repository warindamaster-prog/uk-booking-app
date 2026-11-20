"use server";

import { redirect } from "next/navigation";
import { zodState, type FormState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";
import { resetSchema } from "@/lib/validation/auth";

/** Sets the new password for the person who followed the emailed link (they have a session from it). */
export async function setNewPassword(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") };
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, {});

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password?error=expired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // The link already signed them in, so "same as the old one" simply means they remembered it.
    if (error.code === "same_password") {
      return { message: "That is already your current password, so nothing needed to change. You're logged in. You can carry on, or choose a different password below.", values: { loggedIn: "1" } };
    }
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Choose a longer or less common one.", values: {} };
    console.error("password change failed", error.code, error.message);
    return { error: "We couldn't change your password. Choose a different one, or request a new link.", values: {} };
  }
  redirect("/dashboard");
}
