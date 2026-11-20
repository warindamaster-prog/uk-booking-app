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
  if (error) return { error: "We couldn't change your password. Choose a different one, or request a new link.", values: {} };
  redirect("/dashboard");
}
